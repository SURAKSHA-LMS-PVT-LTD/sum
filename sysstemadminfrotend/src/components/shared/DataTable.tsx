import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink, CheckCircle, ChevronLeft, ChevronRight, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { safeOpenUrl } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface Column {
  key: string;
  label: string;
  type?: "text" | "image" | "badge" | "link" | "currency" | "date";
  render?: (value: any, row: any) => React.ReactNode;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface CustomAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: any) => void;
  show?: (row: any) => boolean;
  variant?: "default" | "destructive";
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  isLoading?: boolean;
  onView?: (row: any) => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onVerify?: (row: any) => void;
  showViewSlip?: boolean;
  slipUrlKey?: string;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onImageClick?: (imageUrl: string) => void;
  customActions?: CustomAction[];
}

export function DataTable({ 
  columns, 
  data, 
  isLoading, 
  onView, 
  onEdit,
  onDelete,
  onVerify,
  showViewSlip,
  slipUrlKey,
  pagination,
  onPageChange,
  onLimitChange,
  onImageClick,
  customActions
}: DataTableProps) {
  const getStatusColor = (status: any) => {
    const statusStr = typeof status === 'boolean' 
      ? (status ? 'ACTIVE' : 'INACTIVE')
      : String(status ?? '').toUpperCase();
    
    switch (statusStr) {
      case "VERIFIED":
      case "APPROVED":
      case "ACTIVE":
      case "TRUE":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "REJECTED":
      case "INACTIVE":
      case "FALSE":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const renderCell = (column: Column, row: any) => {
    const value = row[column.key];

    if (column.render) {
      return column.render(value, row);
    }

    switch (column.type) {
      case "image":
        return (
          <Avatar 
            className={`h-10 w-10 ${onImageClick && value ? 'cursor-pointer hover:ring-2 ring-primary transition-all' : ''}`}
            onClick={() => onImageClick && value && onImageClick(value)}
          >
            <AvatarImage src={value} alt="Image" />
            <AvatarFallback>
              {row.firstName?.charAt(0) || row.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        );
      case "badge":
        return (
          <Badge className={getStatusColor(value)} variant="secondary">
            {value || "N/A"}
          </Badge>
        );
      case "link":
        return value ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => safeOpenUrl(value)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      case "currency":
        return value ? `Rs. ${parseFloat(value).toLocaleString()}` : "-";
      case "date":
        return value ? new Date(value).toLocaleDateString() : "-";
      default:
        return value || "-";
    }
  };

  const hasNextPage = pagination?.hasNextPage ?? pagination?.hasNext ?? (pagination && pagination.page < pagination.totalPages);
  const hasPreviousPage = pagination?.hasPreviousPage ?? pagination?.hasPrev ?? (pagination && pagination.page > 1);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="h-8 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              {showViewSlip && <TableHead>Slip</TableHead>}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={row.id || idx}>
                {columns.map((col) => (
                  <TableCell key={col.key}>{renderCell(col, row)}</TableCell>
                ))}
                {showViewSlip && slipUrlKey && (
                  <TableCell>
                    {row[slipUrlKey] ? (
                      <div className="flex items-center gap-2">
                        <Avatar 
                          className="h-10 w-10 cursor-pointer hover:ring-2 ring-primary transition-all"
                          onClick={() => onImageClick && onImageClick(row[slipUrlKey])}
                        >
                          <AvatarImage src={row[slipUrlKey]} alt="Slip" />
                          <AvatarFallback>📄</AvatarFallback>
                        </Avatar>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => safeOpenUrl(row[slipUrlKey])}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex gap-2">
                    {onView && (
                      <Button variant="outline" size="sm" onClick={() => onView(row)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                    {onEdit && (
                      <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="outline" size="sm" onClick={() => onDelete(row)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    {onVerify && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => onVerify(row)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Verify
                      </Button>
                    )}
                    {customActions && customActions.length > 0 && (() => {
                      const visibleActions = customActions.filter(action => 
                        action.show ? action.show(row) : true
                      );
                      if (visibleActions.length === 0) return null;
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="ml-1">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[180px]">
                            {visibleActions.map((action, actionIdx) => (
                              <DropdownMenuItem
                                key={actionIdx}
                                onClick={() => action.onClick(row)}
                                className={action.variant === "destructive" ? "text-destructive" : ""}
                              >
                                {action.icon && <span className="mr-2">{action.icon}</span>}
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {pagination && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <Select
              value={String(pagination.limit)}
              onValueChange={(value) => onLimitChange?.(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
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

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={!hasPreviousPage}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={!hasNextPage}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
