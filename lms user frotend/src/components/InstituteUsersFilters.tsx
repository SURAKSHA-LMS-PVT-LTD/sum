import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X, Search, RefreshCw, Cake } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface InstituteUserFilterParams {
  page?: number;
  limit?: number;
  houseId?: string;
  search?: string;
  isActive?: boolean;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  minAge?: number;
  maxAge?: number;
  city?: string;
  sortBy?: 'createdAt' | 'name' | 'email' | 'dateOfBirth';
  sortOrder?: 'ASC' | 'DESC';
  // Birthday filter (month/day only — year ignored)
  birthdayMonth?: number;
  birthdayDay?: number;
  // Student-specific
  studentId?: string;
  emergencyContact?: string;
  hasMedicalConditions?: boolean;
  hasAllergies?: boolean;
  // Parent-specific
  occupation?: string;
  workplace?: string;
}

type BirthdayMode = 'month' | 'day' | 'monthday';

interface InstituteUsersFiltersProps {
  filters: InstituteUserFilterParams;
  onFiltersChange: (filters: InstituteUserFilterParams) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  userType: 'STUDENT' | 'TEACHER' | 'ATTENDANCE_MARKER' | 'INSTITUTE_ADMIN' | 'PENDING' | 'INACTIVE';
  isApplying?: boolean;
  houseOptions?: Array<{ id: string; name: string }>;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FILTER_LABELS: Record<string, string> = {
  houseId: 'House',
  isActive: 'Status',
  gender: 'Gender',
  sortBy: 'Sort By',
  sortOrder: 'Sort Order',
  city: 'City',
  limit: 'Per Page',
  minAge: 'Min Age',
  maxAge: 'Max Age',
  birthdayMonth: 'Birthday Month',
  birthdayDay: 'Birthday Day',
  studentId: 'Student ID',
  emergencyContact: 'Emergency Contact',
  hasMedicalConditions: 'Has Medical Conditions',
  hasAllergies: 'Has Allergies',
  occupation: 'Parent Occupation',
  workplace: 'Parent Workplace',
};

function formatFilterValue(key: string, value: any): string {
  if (key === 'birthdayMonth') return MONTHS[Number(value) - 1] || String(value);
  if (key === 'isActive') return value ? 'Active' : 'Inactive';
  if (key === 'hasMedicalConditions') return value ? 'Yes' : 'No';
  if (key === 'hasAllergies') return value ? 'Yes' : 'No';
  if (key === 'sortBy') {
    const labels: Record<string, string> = { createdAt: 'Join Date', name: 'Name', email: 'Email', dateOfBirth: 'Birthday' };
    return labels[String(value)] || String(value);
  }
  if (key === 'sortOrder') return value === 'ASC' ? 'Ascending' : 'Descending';
  return String(value);
}

const InstituteUsersFilters: React.FC<InstituteUsersFiltersProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  userType,
  isApplying = false,
  houseOptions = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Birthday mode local state (derived from which params are set)
  const hasBirthdayMonth = filters.birthdayMonth !== undefined;
  const hasBirthdayDay = filters.birthdayDay !== undefined;
  const [birthdayMode, setBirthdayMode] = useState<BirthdayMode | null>(() => {
    if (hasBirthdayMonth && hasBirthdayDay) return 'monthday';
    if (hasBirthdayMonth) return 'month';
    if (hasBirthdayDay) return 'day';
    return null;
  });

  const updateFilter = (key: keyof InstituteUserFilterParams, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilter = (key: keyof InstituteUserFilterParams) => {
    const next = { ...filters };
    delete next[key];
    onFiltersChange(next);
  };

  const handleBirthdayModeToggle = (mode: BirthdayMode) => {
    if (birthdayMode === mode) {
      // Deselect
      setBirthdayMode(null);
      const next = { ...filters };
      delete next.birthdayMonth;
      delete next.birthdayDay;
      onFiltersChange(next);
      return;
    }
    setBirthdayMode(mode);
    // Clear the param that's not relevant to the new mode
    const next = { ...filters };
    if (mode === 'month') delete next.birthdayDay;
    if (mode === 'day') delete next.birthdayMonth;
    onFiltersChange(next);
  };

  const getActiveFilterCount = () => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'page' || key === 'limit') return false;
      return value !== undefined && value !== null && value !== '';
    }).length;
  };

  const isSortByDob = filters.sortBy === 'dateOfBirth';
  const isStudent = userType === 'STUDENT';
  const supportsHouseFilter = userType === 'STUDENT' || userType === 'TEACHER' || userType === 'ATTENDANCE_MARKER';

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Filters & Search</span>
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="text-xs">{getActiveFilterCount()} active</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                {isOpen ? 'Hide' : 'Show'}
              </Button>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0 space-y-5">

            {/* Search + Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="search" className="text-xs mb-1 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Name, email, phone, ID..."
                    value={filters.search || ''}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <Button onClick={onApplyFilters} disabled={isApplying} size="sm" className="h-9">
                  {isApplying ? (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Applying…</>
                  ) : (
                    <><Search className="h-3.5 w-3.5 mr-1.5" />Apply</>
                  )}
                </Button>
                <Button variant="outline" size="sm" className="h-9" onClick={onClearFilters}>
                  Clear All
                </Button>
              </div>
            </div>

            {/* Active filter chips */}
            {getActiveFilterCount() > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(filters).map(([key, value]) => {
                  if (key === 'page' || key === 'limit' || value === undefined || value === null || value === '') return null;
                  const label = FILTER_LABELS[key] || key;
                  const display = formatFilterValue(key, value);
                  return (
                    <Badge key={key} variant="secondary" className="flex items-center gap-1 text-xs pr-1">
                      <span className="text-muted-foreground">{label}:</span>
                      <span>{display}</span>
                      <button
                        onClick={() => {
                          clearFilter(key as keyof InstituteUserFilterParams);
                          if (key === 'birthdayMonth' && !filters.birthdayDay) setBirthdayMode(null);
                          if (key === 'birthdayDay' && !filters.birthdayMonth) setBirthdayMode(null);
                          if (key === 'birthdayMonth' && filters.birthdayDay) setBirthdayMode('day');
                          if (key === 'birthdayDay' && filters.birthdayMonth) setBirthdayMode('month');
                        }}
                        className="ml-0.5 rounded-sm hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Core filter grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

              {/* House */}
              {supportsHouseFilter && (
                <div className="space-y-1">
                  <Label className="text-xs">House</Label>
                  <Select
                    value={filters.houseId || 'all'}
                    onValueChange={(v) => updateFilter('houseId', v === 'all' ? undefined : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All houses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All houses</SelectItem>
                      {houseOptions.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status */}
              {userType !== 'INACTIVE' && (
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={filters.isActive === undefined ? 'all' : String(filters.isActive)}
                    onValueChange={(v) => updateFilter('isActive', v === 'all' ? undefined : v === 'true')}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Gender */}
              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
                <Select
                  value={filters.gender || 'all'}
                  onValueChange={(v) => updateFilter('gender', v === 'all' ? undefined : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All genders</SelectItem>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="space-y-1">
                <Label className="text-xs">Sort By</Label>
                <Select
                  value={filters.sortBy || 'createdAt'}
                  onValueChange={(v) => updateFilter('sortBy', v as InstituteUserFilterParams['sortBy'])}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Join Date</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="dateOfBirth">Birthday (Month & Day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order — labels adapt when sorting by birthday */}
              <div className="space-y-1">
                <Label className="text-xs">Sort Order</Label>
                <Select
                  value={filters.sortOrder || 'DESC'}
                  onValueChange={(v) => updateFilter('sortOrder', v as 'ASC' | 'DESC')}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isSortByDob ? (
                      <>
                        <SelectItem value="ASC">Jan → Dec</SelectItem>
                        <SelectItem value="DESC">Dec → Jan</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="DESC">Newest First</SelectItem>
                        <SelectItem value="ASC">Oldest First</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* City */}
              <div className="space-y-1">
                <Label htmlFor="city" className="text-xs">City / Address</Label>
                <Input
                  id="city"
                  placeholder="Filter by city"
                  value={filters.city || ''}
                  onChange={(e) => updateFilter('city', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Items per page */}
              <div className="space-y-1">
                <Label className="text-xs">Per Page</Label>
                <Select
                  value={String(filters.limit || 50)}
                  onValueChange={(v) => updateFilter('limit', parseInt(v))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Age range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="minAge" className="text-xs">Min Age</Label>
                <Input
                  id="minAge"
                  type="number"
                  placeholder="e.g. 5"
                  value={filters.minAge ?? ''}
                  onChange={(e) => updateFilter('minAge', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxAge" className="text-xs">Max Age</Label>
                <Input
                  id="maxAge"
                  type="number"
                  placeholder="e.g. 18"
                  value={filters.maxAge ?? ''}
                  onChange={(e) => updateFilter('maxAge', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="h-9"
                />
              </div>
            </div>

            {/* ── BIRTHDAY FILTER ─────────────────────────────────────────── */}
            <div className="border border-border/50 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Cake className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Birthday Filter</span>
                <span className="text-xs text-muted-foreground">(year is ignored — matches by month/day only)</span>
              </div>

              {/* Mode toggles */}
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    { mode: 'month' as BirthdayMode, label: 'Month only' },
                    { mode: 'day' as BirthdayMode, label: 'Day only' },
                    { mode: 'monthday' as BirthdayMode, label: 'Month + Day' },
                  ]
                ).map(({ mode, label }) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={birthdayMode === mode}
                      onCheckedChange={() => handleBirthdayModeToggle(mode)}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>

              {/* Month picker */}
              {(birthdayMode === 'month' || birthdayMode === 'monthday') && (
                <div className="space-y-1">
                  <Label className="text-xs">Month</Label>
                  <Select
                    value={filters.birthdayMonth !== undefined ? String(filters.birthdayMonth) : 'none'}
                    onValueChange={(v) => updateFilter('birthdayMonth', v === 'none' ? undefined : parseInt(v))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any month</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Day picker */}
              {(birthdayMode === 'day' || birthdayMode === 'monthday') && (
                <div className="space-y-1">
                  <Label htmlFor="birthdayDay" className="text-xs">Day of Month</Label>
                  <Input
                    id="birthdayDay"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="1 – 31"
                    value={filters.birthdayDay ?? ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      updateFilter('birthdayDay', e.target.value === '' ? undefined : Math.min(31, Math.max(1, v)));
                    }}
                    className="h-9 w-32"
                  />
                  <p className="text-xs text-muted-foreground">Enter a day (1–31)</p>
                </div>
              )}

              {birthdayMode === null && (
                <p className="text-xs text-muted-foreground">Select a mode above to filter by birthday.</p>
              )}
            </div>

            {/* Student-specific */}
            {isStudent && (
              <div className="border-t pt-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student-Specific Filters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="studentId" className="text-xs">Student ID</Label>
                    <Input
                      id="studentId"
                      placeholder="e.g. STU2024001"
                      value={filters.studentId || ''}
                      onChange={(e) => updateFilter('studentId', e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="emergencyContact" className="text-xs">Emergency Contact</Label>
                    <Input
                      id="emergencyContact"
                      placeholder="Emergency phone"
                      value={filters.emergencyContact || ''}
                      onChange={(e) => updateFilter('emergencyContact', e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Has Medical Conditions</Label>
                    <Select
                      value={filters.hasMedicalConditions === undefined ? 'any' : String(filters.hasMedicalConditions)}
                      onValueChange={(v) => updateFilter('hasMedicalConditions', v === 'any' ? undefined : v === 'true')}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Has Allergies</Label>
                    <Select
                      value={filters.hasAllergies === undefined ? 'any' : String(filters.hasAllergies)}
                      onValueChange={(v) => updateFilter('hasAllergies', v === 'any' ? undefined : v === 'true')}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="occupation" className="text-xs">Parent Occupation</Label>
                    <Input
                      id="occupation"
                      placeholder="e.g. Engineer"
                      value={filters.occupation || ''}
                      onChange={(e) => updateFilter('occupation', e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="workplace" className="text-xs">Parent Workplace</Label>
                    <Input
                      id="workplace"
                      placeholder="e.g. Tech Ltd"
                      value={filters.workplace || ''}
                      onChange={(e) => updateFilter('workplace', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default InstituteUsersFilters;
