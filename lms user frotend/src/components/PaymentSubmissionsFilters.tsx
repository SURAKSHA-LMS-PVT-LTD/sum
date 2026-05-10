import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Search, Calendar, DollarSign } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface FilterParams {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  paymentMethod?: 'BANK_TRANSFER' | 'UPI' | 'ONLINE_PAYMENT' | 'CASH_DEPOSIT' | 'CHEQUE';
  paymentDateFrom?: string;
  paymentDateTo?: string;
  submissionDateFrom?: string;
  submissionDateTo?: string;
  verificationDateFrom?: string;
  verificationDateTo?: string;
  amountFrom?: number;
  amountTo?: number;
  studentId?: string;
  studentName?: string;
  search?: string;
  hasLateFee?: boolean;
  hasAttachment?: boolean;
  sortBy?: 'paymentDate' | 'submissionDate' | 'verificationDate' | 'amount' | 'status' | 'studentName';
  sortOrder?: 'ASC' | 'DESC';
}

interface PaymentSubmissionsFiltersProps {
  filters: FilterParams;
  onFiltersChange: (filters: FilterParams) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

const PaymentSubmissionsFilters: React.FC<PaymentSubmissionsFiltersProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const updateFilter = (key: keyof FilterParams, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const getActiveFilterCount = () => {
    const activeFilters = Object.entries(filters).filter(([key, value]) => {
      if (key === 'page' || key === 'limit') return false;
      return value !== undefined && value !== null && value !== '';
    });
    return activeFilters.length;
  };

  const clearFilter = (key: keyof FilterParams) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  return (
    <>
      {/* Mobile Filter Sheet */}
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="md:hidden mb-6 w-full gap-2">
            <Filter className="h-4 w-4" />
            Filters & Search
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-auto">{getActiveFilterCount()} active</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filters & Search</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-6 px-4">
              {/* Search and Quick Actions */}
              <div className="flex flex-col gap-4">
                <div className="flex-1">
                  <Label htmlFor="search-mobile">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search-mobile"
                      placeholder="Search in transaction ref, remarks, notes..."
                      value={filters.search || ''}
                      onChange={(e) => updateFilter('search', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => { onApplyFilters(); setIsFilterSheetOpen(false); }} className="flex items-center space-x-2 flex-1">
                    <Search className="h-4 w-4" />
                    <span>Apply</span>
                  </Button>
                  <Button variant="outline" onClick={() => { onClearFilters(); setIsFilterSheetOpen(false); }} className="flex-1">
                    Clear All
                  </Button>
                </div>
              </div>
              {/* Filter Controls */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={filters.status || 'all'} onValueChange={(value) => updateFilter('status', value === 'all' ? undefined : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="VERIFIED">Verified</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={filters.paymentMethod || 'all'} onValueChange={(value) => updateFilter('paymentMethod', value === 'all' ? undefined : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All methods</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="ONLINE_PAYMENT">Online Payment</SelectItem>
                      <SelectItem value="CASH_DEPOSIT">Cash Deposit</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      {/* Desktop Filter Card */}
      <Card className="mb-6 hidden md:block">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filters & Search</span>
                  {getActiveFilterCount() > 0 && (
                    <Badge variant="secondary">{getActiveFilterCount()} active</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm">
                  {isOpen ? 'Hide' : 'Show'}
                </Button>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Search and Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search in transaction ref, remarks, notes..."
                    value={filters.search || ''}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={onApplyFilters} className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span>Apply</span>
                </Button>
                <Button variant="outline" onClick={onClearFilters}>
                  Clear All
                </Button>
              </div>
            </div>

            {/* Active Filters Display */}
            {getActiveFilterCount() > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {Object.entries(filters).map(([key, value]) => {
                  if (key === 'page' || key === 'limit' || !value) return null;
                  return (
                    <Badge key={key} variant="secondary" className="flex items-center space-x-1">
                      <span>{key}: {String(value)}</span>
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => clearFilter(key as keyof FilterParams)}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <Label>Status</Label>
                <Select value={filters.status || 'all'} onValueChange={(value) => updateFilter('status', value === 'all' ? undefined : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <Label>Payment Method</Label>
                <Select value={filters.paymentMethod || 'all'} onValueChange={(value) => updateFilter('paymentMethod', value === 'all' ? undefined : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All methods</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="ONLINE_PAYMENT">Online Payment</SelectItem>
                    <SelectItem value="CASH_DEPOSIT">Cash Deposit</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div>
                <Label>Sort By</Label>
                <Select value={filters.sortBy || 'submissionDate'} onValueChange={(value) => updateFilter('sortBy', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submissionDate">Submission Date</SelectItem>
                    <SelectItem value="paymentDate">Payment Date</SelectItem>
                    <SelectItem value="verificationDate">Verification Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="studentName">Student Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div>
                <Label>Sort Order</Label>
                <Select value={filters.sortOrder || 'DESC'} onValueChange={(value) => updateFilter('sortOrder', value as 'ASC' | 'DESC')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESC">Newest First</SelectItem>
                    <SelectItem value="ASC">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Student Name */}
              <div>
                <Label htmlFor="studentName">Student Name</Label>
                <Input
                  id="studentName"
                  placeholder="Search by student name"
                  value={filters.studentName || ''}
                  onChange={(e) => updateFilter('studentName', e.target.value)}
                />
              </div>

              {/* Items per Page */}
              <div>
                <Label>Items per Page</Label>
                <Select value={String(filters.limit || 10)} onValueChange={(value) => updateFilter('limit', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Payment Date From</span>
                </Label>
                <Input
                  type="date"
                  value={filters.paymentDateFrom || ''}
                  onChange={(e) => updateFilter('paymentDateFrom', e.target.value)}
                />
              </div>
              
              <div>
                <Label>Payment Date To</Label>
                <Input
                  type="date"
                  value={filters.paymentDateTo || ''}
                  onChange={(e) => updateFilter('paymentDateTo', e.target.value)}
                />
              </div>

              <div>
                <Label>Submission Date From</Label>
                <Input
                  type="date"
                  value={filters.submissionDateFrom || ''}
                  onChange={(e) => updateFilter('submissionDateFrom', e.target.value)}
                />
              </div>

              <div>
                <Label>Submission Date To</Label>
                <Input
                  type="date"
                  value={filters.submissionDateTo || ''}
                  onChange={(e) => updateFilter('submissionDateTo', e.target.value)}
                />
              </div>

              <div>
                <Label>Verification Date From</Label>
                <Input
                  type="date"
                  value={filters.verificationDateFrom || ''}
                  onChange={(e) => updateFilter('verificationDateFrom', e.target.value)}
                />
              </div>

              <div>
                <Label>Verification Date To</Label>
                <Input
                  type="date"
                  value={filters.verificationDateTo || ''}
                  onChange={(e) => updateFilter('verificationDateTo', e.target.value)}
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Amount From</span>
                </Label>
                <Input
                  type="number"
                  placeholder="Min amount"
                  value={filters.amountFrom || ''}
                  onChange={(e) => updateFilter('amountFrom', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              
              <div>
                <Label>Amount To</Label>
                <Input
                  type="number"
                  placeholder="Max amount"
                  value={filters.amountTo || ''}
                  onChange={(e) => updateFilter('amountTo', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>

            {/* Boolean Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Late Fee Applied</Label>
                <Select 
                  value={filters.hasLateFee === undefined ? 'any' : String(filters.hasLateFee)} 
                  onValueChange={(value) => updateFilter('hasLateFee', value === 'any' ? undefined : value === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Has Attachment</Label>
                <Select 
                  value={filters.hasAttachment === undefined ? 'any' : String(filters.hasAttachment)} 
                  onValueChange={(value) => updateFilter('hasAttachment', value === 'any' ? undefined : value === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      </Card>
    </>
  );
};

export default PaymentSubmissionsFilters;