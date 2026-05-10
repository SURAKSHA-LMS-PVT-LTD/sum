import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, ChevronDown, X, Calendar, Search, Users } from 'lucide-react';
import { ALL_ATTENDANCE_STATUSES, ATTENDANCE_STATUS_CONFIG } from '@/types/attendance.types';

export interface AttendanceFilterParams {
  searchTerm?: string;
  status?: string;
  markingMethod?: string;
  startDate?: string;
  endDate?: string;
  studentName?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface AttendanceFiltersProps {
  filters: AttendanceFilterParams;
  onFiltersChange: (filters: AttendanceFilterParams) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof AttendanceFilterParams, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => 
      value !== undefined && value !== null && value !== ''
    ).length;
  };

  const clearFilter = (key: keyof AttendanceFilterParams) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  return (
    <Card className="mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Attendance Filters</CardTitle>
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {getActiveFilterCount()} active
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Search Term */}
              <div className="space-y-2">
                <Label htmlFor="searchTerm" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </Label>
                <Input
                  id="searchTerm"
                  placeholder="Search attendance records..."
                  value={filters.searchTerm || ''}
                  onChange={(e) => updateFilter('searchTerm', e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Attendance Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => updateFilter('status', value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {ALL_ATTENDANCE_STATUSES.map((statusOption) => (
                      <SelectItem key={statusOption} value={statusOption}>
                        {ATTENDANCE_STATUS_CONFIG[statusOption].icon} {ATTENDANCE_STATUS_CONFIG[statusOption].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Marking Method Filter */}
              <div className="space-y-2">
                <Label>Marking Method</Label>
                <Select
                  value={filters.markingMethod || 'all'}
                  onValueChange={(value) => updateFilter('markingMethod', value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="qr">QR Code</SelectItem>
                    <SelectItem value="rfid">RFID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Student Name */}
              <div className="space-y-2">
                <Label htmlFor="studentName" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Student Name
                </Label>
                <Input
                  id="studentName"
                  placeholder="Filter by student name..."
                  value={filters.studentName || ''}
                  onChange={(e) => updateFilter('studentName', e.target.value)}
                />
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="startDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  From Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => updateFilter('startDate', e.target.value)}
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="endDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  To Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => updateFilter('endDate', e.target.value)}
                />
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select
                  value={filters.sortBy || 'none'}
                  onValueChange={(value) => updateFilter('sortBy', value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Default sorting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Default</SelectItem>
                    <SelectItem value="markedAt">Date Marked</SelectItem>
                    <SelectItem value="studentName">Student Name</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Select
                  value={filters.sortOrder || 'desc'}
                  onValueChange={(value) => updateFilter('sortOrder', value as 'asc' | 'desc')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex flex-wrap gap-2 justify-between items-center pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                <Button onClick={onApplyFilters} className="bg-primary hover:bg-primary/90">
                  Apply Filters
                </Button>
                <Button 
                  onClick={() => {
                    onClearFilters();
                    // Automatically apply after clearing
                    setTimeout(() => onApplyFilters(), 100);
                  }} 
                  variant="outline"
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Active Filters Display */}
            {getActiveFilterCount() > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Label className="text-sm font-medium mb-2 block">Active Filters:</Label>
                <div className="flex flex-wrap gap-2">
                  {filters.searchTerm && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Search: {filters.searchTerm}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => clearFilter('searchTerm')}
                      />
                    </Badge>
                  )}
                  {filters.status && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Status: {filters.status}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => clearFilter('status')}
                      />
                    </Badge>
                  )}
                  {filters.markingMethod && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Method: {filters.markingMethod.toUpperCase()}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => clearFilter('markingMethod')}
                      />
                    </Badge>
                  )}
                  {filters.studentName && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Student: {filters.studentName}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => clearFilter('studentName')}
                      />
                    </Badge>
                  )}
                  {filters.startDate && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      From: {filters.startDate}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => clearFilter('startDate')}
                      />
                    </Badge>
                  )}
                  {filters.endDate && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      To: {filters.endDate}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => clearFilter('endDate')}
                      />
                    </Badge>
                  )}
                  {filters.sortBy && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Sort: {filters.sortBy} ({filters.sortOrder})
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => {
                          clearFilter('sortBy');
                          clearFilter('sortOrder');
                        }}
                      />
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default AttendanceFilters;