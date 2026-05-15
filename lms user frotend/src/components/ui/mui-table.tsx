import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Eye, Plus, MoreVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
interface Column {
  id: string;
  label: string | React.ReactNode;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any, row?: any) => React.ReactNode;
}
interface MUITableProps {
  title: string;
  columns: Column[];
  data: any[];
  onAdd?: () => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onView?: (row: any) => void;
  onRowClick?: (row: any) => void;
  customActions?: Array<{
    label: string;
    action: (row: any) => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'destructive' | 'outline';
    className?: string;
    condition?: (row: any) => boolean; // Optional condition to show/hide action per row
    disabledCondition?: (row: any) => boolean; // Optional condition to disable action per row
    disabledLabel?: string; // Label to show when disabled
  }>;
  // Pagination props
  page: number;
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
  // Section type for different behaviors
  sectionType?: 'lectures' | 'homework' | 'exams' | 'students' | 'classes' | 'subjects' | 'class-subjects';
  allowAdd?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  /** Unique key for persisting column visibility per table (defaults to title-based key) */
  storageKey?: string;
}

const getActionColumnWidth = (label: string, disabledLabel?: string) => {
  const text = disabledLabel && disabledLabel.length > label.length ? disabledLabel : label;
  return Math.min(Math.max(text.length * 8 + 52, 112), 176);
};

export default function MUITable({
  title,
  columns,
  data,
  onAdd,
  onEdit,
  onDelete,
  onView,
  onRowClick,
  customActions = [],
  page,
  rowsPerPage,
  totalCount,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [25, 50, 100],
  sectionType,
  allowAdd = true,
  allowEdit = true,
  allowDelete = true,
  storageKey = '',
}: MUITableProps) {
  const {
    user
  } = useAuth();
  const instituteRole = useInstituteRole();
  
  const handleChangePage = (event: unknown, newPage: number) => {
    onPageChange(newPage);
  };
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    onRowsPerPageChange(newRowsPerPage);
    onPageChange(0);
  };

  // Permission checks using institute role
  const canAdd = allowAdd && onAdd && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');
  const canEdit = allowEdit && onEdit && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');
  const canDelete = allowDelete && onDelete && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');

  // ── Action columns: keep them compact so table rows stay readable ──
  const actionCols = React.useMemo<Column[]>(() => {
    const isAdminOrTeacher = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';
    const isStudent = instituteRole === 'Student';
    const cols: Column[] = [];
    const hasActions = Boolean(
      (onView && sectionType !== 'lectures') ||
      allowEdit && onEdit && (isAdminOrTeacher || (isStudent && sectionType === 'homework')) ||
      allowDelete && onDelete && isAdminOrTeacher ||
      customActions.length > 0
    );
    if (hasActions) {
      cols.push({ id: '_act_actions', label: 'Actions', minWidth: 160, align: 'center' as const });
    }
    return cols;
  }, [onView, onEdit, onDelete, allowEdit, allowDelete, sectionType, instituteRole, customActions]);
  const hasActions = actionCols.length > 0;
  const allColumns = React.useMemo(() => [...columns, ...actionCols], [columns, actionCols]);

  // ── Column resizing (via shared hook) ───────────────────────────
  const colDefaultWidths = React.useMemo(() => {
    const m: Record<string, number> = {};
    allColumns.forEach(c => { m[c.id] = c.minWidth || 150; });
    return m;
  }, [allColumns]);
  const colIds = React.useMemo(() => allColumns.map(c => c.id), [allColumns]);
  const { getWidth, totalWidth: totalTableWidth, setHoveredCol, hoveredCol, activeCol, startResize } =
    useResizableColumns(colIds, colDefaultWidths);

  // ── Column visibility (user-configurable) ────────────────────────
  const columnDefsForConfig = React.useMemo<ColumnDef[]>(() => [
    ...columns.map((col, i) => ({
      key: col.id,
      header: col.label,
      defaultVisible: true,
      locked: i === 0,
      defaultWidth: col.minWidth || 150,
      minWidth: col.minWidth || 80,
    })),
    ...actionCols.map(col => ({
      key: col.id,
      header: col.label,
      defaultVisible: true,
      locked: false,
      defaultWidth: col.minWidth || 90,
      minWidth: 60,
    })),
  ], [columns, actionCols]);
  const cfgKey = storageKey || `muitbl-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const { colState, visibleColumns: visibleDataColDefs, toggleColumn, resetColumns } = useColumnConfig(columnDefsForConfig, cfgKey);
  const visibleKeys = React.useMemo(() => new Set(visibleDataColDefs.map(c => c.key)), [visibleDataColDefs]);
  const visibleDataColumns = React.useMemo(() => columns.filter(col => visibleKeys.has(col.id)), [columns, visibleKeys]);
  const visibleAllColumns = React.useMemo(() => [
    ...visibleDataColumns,
    ...actionCols.filter(col => visibleKeys.has(col.id)),
  ], [visibleDataColumns, actionCols, visibleKeys]);
  const visibleTotalWidth = React.useMemo(() =>
    visibleAllColumns.reduce((sum, col) => sum + getWidth(col.id), 0),
    [visibleAllColumns, getWidth]
  );

  return <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex justify-end mb-2">
        <ColumnConfigurator
          allColumns={columnDefsForConfig}
          colState={colState}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>
      {/* Table */}
      <Paper sx={{
      width: '100%',
      overflow: 'hidden',
      height: 'calc(100vh - 260px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
        <TableContainer sx={{
        flex: 1,
        overflow: 'auto'
      }}>
          <Table stickyHeader aria-label="sticky table" sx={{ tableLayout: 'fixed', minWidth: visibleTotalWidth }}>
            <TableHead>
              <TableRow>
                {visibleAllColumns.map(column => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    style={{
                      /* NOTE: NO overflow:hidden here — it clips the absolute resize handle */
                      width: getWidth(column.id),
                      minWidth: getWidth(column.id),
                      maxWidth: getWidth(column.id),
                      position: 'relative',
                      userSelect: 'none',
                    }}
                    sx={{
                      fontWeight: 'bold',
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))',
                      borderBottom: '1px solid hsl(var(--border))',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={() => setHoveredCol(column.id)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 12 }}>
                      {column.label}
                    </div>
                    <ResizeHandle colId={column.id} hoveredCol={hoveredCol} activeCol={activeCol} onMouseDown={startResize} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, index) => {
              console.log('Row data:', row, 'Index:', index);
              return <TableRow 
                       hover 
                       role="checkbox" 
                       tabIndex={-1} 
                       key={index}
                       onClick={() => onRowClick && onRowClick(row)}
                       className={onRowClick ? 'cursor-pointer' : ''}
                       sx={{
                         '&:hover': onRowClick ? {
                           backgroundColor: 'hsl(var(--muted)/0.5) !important',
                           transition: 'background-color 0.2s'
                         } : {}
                       }}
                     >
                    {columns.map(column => {
                  const isVisible = visibleKeys.has(column.id);
                  if (!isVisible) return null;
                  const value = row[column.id];
                  console.log(`Column ${column.id}:`, value, 'from row:', row);
                  const renderer = (column as any).format || (column as any).render;
                  let cellContent: React.ReactNode = renderer ? renderer(value, row) : (value || '-');
                  if (!renderer) {
                    const id = (column.id || '').toLowerCase();
                    const isLikelyImage = typeof value === 'string' && (value.startsWith('http') || value.startsWith('/')) && /\.(png|jpe?g|gif|webp|svg)$/i.test(value);
                    const isImageColumn = id.includes('image') || id.includes('img') || id.includes('logo');
                    if ((isLikelyImage || isImageColumn) && typeof value === 'string') {
                      cellContent = (
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={value}
                            alt={`${column.label} image`}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                          />
                        </div>
                      );
                    }
                  }
                  return <TableCell key={column.id} align={column.align} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: getWidth(column.id), maxWidth: getWidth(column.id) }}>
                        {cellContent}
                      </TableCell>;
                })}
                    {actionCols.map(col => {
                          if (!visibleKeys.has(col.id)) return null;
                          const isAdminOrTeacher = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';
                          const canSeeView = isAdminOrTeacher || (instituteRole === 'Student' && sectionType === 'homework') || sectionType === 'students';
                          const canSeeEdit = allowEdit && onEdit && (isAdminOrTeacher || (instituteRole === 'Student' && sectionType === 'homework'));
                          const canSeeDelete = allowDelete && onDelete && isAdminOrTeacher;
                          const rowActions: Array<{
                            label: string;
                            icon?: React.ReactNode;
                            onClick: () => void;
                            disabled?: boolean;
                            className?: string;
                          }> = [];

                          if (onView && canSeeView) {
                            rowActions.push({ label: sectionType === 'exams' ? 'View Results' : 'View', icon: <Eye className="h-4 w-4" />, onClick: () => onView(row) });
                          }

                          if (canSeeEdit) {
                            rowActions.push({
                              label: instituteRole === 'Student' && sectionType === 'homework' ? 'Submit' : 'Edit',
                              icon: instituteRole === 'Student' && sectionType === 'homework' ? <Plus className="h-4 w-4" /> : <Edit className="h-4 w-4" />,
                              onClick: () => onEdit!(row),
                            });
                          }

                          if (canSeeDelete) {
                            rowActions.push({
                              label: 'Delete',
                              icon: <Trash2 className="h-4 w-4" />,
                              onClick: () => onDelete!(row),
                              className: 'text-destructive',
                            });
                          }

                          customActions.forEach(action => {
                            if (action.condition && !action.condition(row)) return;
                            const isDisabled = action.disabledCondition ? action.disabledCondition(row) : false;
                            const buttonLabel = isDisabled && action.disabledLabel ? action.disabledLabel : action.label;
                            rowActions.push({
                              label: buttonLabel,
                              icon: action.icon,
                              onClick: () => !isDisabled && action.action(row),
                              disabled: isDisabled,
                              className: `${action.className || ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`,
                            });
                          });

                          return (
                            <TableCell key={col.id} align="center" style={{ width: getWidth(col.id), maxWidth: getWidth(col.id) }} sx={{ px: 1.25, py: 1.25 }}>
                              {rowActions.length <= 1 ? (
                                rowActions[0] ? (
                                  <Button
                                    variant={rowActions[0].className?.includes('text-destructive') ? 'destructive' : 'outline'}
                                    size="sm"
                                    onClick={rowActions[0].onClick}
                                    disabled={rowActions[0].disabled}
                                    className={`h-8 w-full justify-center overflow-hidden px-2 text-xs ${rowActions[0].className || ''}`}
                                    title={rowActions[0].label}
                                  >
                                    {rowActions[0].icon && <span className="mr-1 shrink-0">{rowActions[0].icon}</span>}
                                    <span className="truncate">{rowActions[0].label}</span>
                                  </Button>
                                ) : null
                              ) : (
                                <div className="flex justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs shadow-sm">
                                        <MoreVertical className="mr-1 h-4 w-4" />
                                        Actions
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="min-w-44">
                                      {rowActions.map((action, index) => (
                                        <DropdownMenuItem
                                          key={`${action.label}-${index}`}
                                          onClick={action.disabled ? undefined : action.onClick}
                                          disabled={action.disabled}
                                          className={action.className}
                                        >
                                          {action.icon && <span className="mr-2 h-4 w-4 shrink-0">{action.icon}</span>}
                                          <span>{action.label}</span>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                  </TableRow>;
            })}
              {data.length === 0 && <TableRow>
                  <TableCell colSpan={visibleAllColumns.length} align="center">
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No records found</p>
                    </div>
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination rowsPerPageOptions={rowsPerPageOptions} component="div" count={totalCount} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} sx={{ flexShrink: 0, borderTop: '1px solid hsl(var(--border))' }} />
      </Paper>
    </div>;
}