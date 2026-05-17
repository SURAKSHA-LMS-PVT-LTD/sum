import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MUITable from '@/components/ui/mui-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, RefreshCw, Search, Plus, AlertTriangle, User, MapPin, Phone, Briefcase, Calendar, Home, Filter, ChevronDown, ChevronUp, X, Eye, GraduationCap, Mail, Check, ChevronsUpDown, LayoutGrid, Table2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { type UserRole } from '@/contexts/types/auth.types';
import { useToast } from '@/hooks/use-toast';
import { useTableData } from '@/hooks/useTableData';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import CurrentSelection from '@/components/ui/current-selection';
import { SafeImage } from '@/components/ui/SafeImage';
import { Occupation, formatOccupation } from '@/types/occupation.types';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/hooks/useViewMode';
import { type ColumnDef } from '@/hooks/useColumnConfig';

/**
 * Convert a full name to initials + last-name format.
 * e.g. "HEENKENDA MUDIYANSELAGE KAVEESHA SANJANA KARUNARATHNA" → "H.M.K.S. Karunarathna"
 */
const formatNameToInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + '.').join('');
  // Capitalize only first letter of last name
  const formattedLast = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
  return `${initials} ${formattedLast}`;
};

// Searchable Occupation Combobox Component
const OccupationCombobox = ({
  value,
  onValueChange
}: {
  value: string;
  onValueChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const occupations = useMemo(() => {
    return Object.values(Occupation).map(occ => ({
      value: occ,
      label: formatOccupation(occ)
    }));
  }, []);
  const filteredOccupations = useMemo(() => {
    if (!searchQuery) return occupations;
    return occupations.filter(occ => occ.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [occupations, searchQuery]);
  return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full sm:w-[250px] justify-between bg-background">
          {value && value !== 'all' ? formatOccupation(value) : "Filter by Occupation"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search occupation..." value={searchQuery} onValueChange={setSearchQuery} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No occupation found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all" onSelect={() => {
              onValueChange('all');
              setOpen(false);
              setSearchQuery('');
            }}>
                <Check className={cn("mr-2 h-4 w-4", value === 'all' ? "opacity-100" : "opacity-0")} />
                All Occupations
              </CommandItem>
              {filteredOccupations.map(occupation => <CommandItem key={occupation.value} value={occupation.label} onSelect={() => {
              onValueChange(occupation.value);
              setOpen(false);
              setSearchQuery('');
            }}>
                  <Check className={cn("mr-2 h-4 w-4", value === occupation.value ? "opacity-100" : "opacity-0")} />
                  {occupation.label}
                </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>;
};
const Parents = () => {
  const navigate = useNavigate();
  const {
    user,
    selectedInstitute,
    selectedClass
  } = useAuth();
  const {
    toast
  } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { viewMode, setViewMode } = useViewMode();
  const CARD_INITIAL_SHOW = 8;
  const [showAllParentCards, setShowAllParentCards] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: '',
    title: ''
  });
  const [childrenDialog, setChildrenDialog] = useState<{
    isOpen: boolean;
    parent: any;
    children: any[];
  }>({
    isOpen: false,
    parent: null,
    children: []
  });

  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);
  const [selectedOccupation, setSelectedOccupation] = useState<string>('');
  const [selectedWorkplace, setSelectedWorkplace] = useState<string>('');
  const [enrolledAfter, setEnrolledAfter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [includeStudentInfo, setIncludeStudentInfo] = useState(true);
  const [filters, setFilters] = useState({
    instituteId: '',
    name: '',
    phone: '',
    address: ''
  });
  const userRole = useInstituteRole();
  const canViewParents = userRole === 'InstituteAdmin' || userRole === 'Teacher';
  const canCreateParents = userRole === 'InstituteAdmin';

  // Build dynamic endpoint based on selection context
  const getEndpoint = () => {
    if (!selectedInstitute) return '';
    let endpoint = `/institute-users/institute/${selectedInstitute.id}/users/PARENT`;

    // Add class context if class is selected
    if (selectedClass) {
      endpoint += `/class/${selectedClass.id}`;
    }

    // IMPORTANT: Parents page should NOT be subject-specific.
    return endpoint;
  };

  // Use the useTableData hook for better data management and pagination
  const tableData = useTableData({
    endpoint: getEndpoint(),
    defaultParams: {
      students: String(includeStudentInfo),
      ...(selectedOccupation && selectedOccupation !== 'all' && {
        occupation: selectedOccupation
      }),
      ...(selectedWorkplace && {
        workplace: selectedWorkplace
      }),
      ...(enrolledAfter && {
        enrolledAfter
      }),
      ...(sortBy && {
        sortBy
      }),
      ...(sortOrder && {
        sortOrder
      })
    },
    autoLoad: true,
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    dependencies: [selectedOccupation, selectedWorkplace, enrolledAfter, sortBy, sortOrder, selectedClass?.id, includeStudentInfo]
  });

  // --- Configurable column definitions ---
  const allColumnDefs: ColumnDef[] = useMemo(() => [
    {
      key: 'imageUrl',
      header: 'Avatar',
      locked: true,
      defaultVisible: true,
      defaultWidth: 80,
      minWidth: 60,
      render: (value: string, row: any) => <div className="cursor-pointer flex justify-center" onClick={() => {
        if (value) { setImagePreview({ isOpen: true, url: value, title: row.name }); }
      }}>
        <Avatar className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 hover:opacity-80 transition-opacity border-2 border-border">
          <AvatarImage src={getImageUrl(value)} alt={row.name} className="object-cover" />
          <AvatarFallback className="bg-muted"><User className="h-5 w-5 md:h-6 md:w-6" /></AvatarFallback>
        </Avatar>
      </div>
    },
    {
      key: 'name',
      header: 'Name',
      defaultVisible: true,
      defaultWidth: 180,
      minWidth: 120,
      render: (value: string, row: any) => <div className="font-medium text-sm md:text-base">
        {row.nameWithInitials || row.name_with_initials || value || 'N/A'}
      </div>
    },
    {
      key: 'email',
      header: 'Email',
      defaultVisible: true,
      defaultWidth: 200,
      minWidth: 140,
      render: (value: string) => <div className="text-sm flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        {value || 'Not specified'}
      </div>
    },
    {
      key: 'phoneNumber',
      header: 'Phone',
      defaultVisible: true,
      defaultWidth: 150,
      minWidth: 110,
      render: (value: string) => <div className="text-sm flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        {value || 'Not specified'}
      </div>
    },
    {
      key: 'userIdByInstitute',
      header: 'Institute ID',
      defaultVisible: false,
      defaultWidth: 130,
      minWidth: 90,
      render: (value: string) => <span className="font-mono text-sm">{value || 'N/A'}</span>
    },
    {
      key: 'dateOfBirth',
      header: 'Date of Birth',
      defaultVisible: true,
      defaultWidth: 140,
      minWidth: 100,
      render: (value: string) => <div className="text-sm flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {value ? new Date(value).toLocaleDateString() : 'Not specified'}
      </div>
    },
    {
      key: 'addressLine1',
      header: 'Address',
      defaultVisible: true,
      defaultWidth: 200,
      minWidth: 140,
      render: (value: string, row: any) => <div className="text-sm flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <div>
          <div>{value || 'Not specified'}</div>
          {row.addressLine2 && <div className="text-xs text-muted-foreground">{row.addressLine2}</div>}
        </div>
      </div>
    },
    {
      key: 'occupation',
      header: 'Occupation',
      defaultVisible: true,
      defaultWidth: 150,
      minWidth: 100,
      render: (value: string, row: any) => <div className="text-sm">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          {value || 'Not specified'}
        </div>
        {row.workPlace && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <Home className="h-3 w-3" />{row.workPlace}
        </div>}
      </div>
    },
    ...(includeStudentInfo ? [{
      key: 'students',
      header: 'Children',
      defaultVisible: true,
      defaultWidth: 220,
      minWidth: 160,
      render: (value: any[], row: any) => {
        const children = value || row.children || [];
        return <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {children.slice(0, 3).map((child: any, idx: number) => {
                const rawImageUrl = child?.instituteUserImageUrl || child?.profileImageUrl || child?.imageUrl || child?.user?.imageUrl;
                return <Avatar key={idx} className="h-8 w-8 border-2 border-background ring-2 ring-primary/20">
                  <AvatarImage src={getImageUrl(rawImageUrl)} alt={child.name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-xs font-medium">
                    {child.name?.charAt(0) || 'C'}
                  </AvatarFallback>
                </Avatar>;
              })}
              {children.length > 3 && <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                +{children.length - 3}
              </div>}
            </div>
            <Badge variant="secondary" className="text-xs font-semibold bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-primary border border-primary/20">
              {children.length} {children.length === 1 ? 'Child' : 'Children'}
            </Badge>
          </div>
          {children.length > 0 && <Button variant="outline" size="sm" onClick={() => setChildrenDialog({ isOpen: true, parent: row, children })} className="h-8 px-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 hover:from-blue-500/10 hover:to-purple-500/10 border-primary/20 hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow">
            <Eye className="h-4 w-4 mr-1.5 text-primary" />
            <span className="font-medium">View</span>
          </Button>}
        </div>;
      }
    } as ColumnDef] : [])
  ], [includeStudentInfo]);

  // Map ALL columns to MUITable format — MUITable's built-in ColumnConfigurator handles visibility
  const muiColumns = useMemo(() =>
    allColumnDefs.map(col => ({
      id: col.key,
      label: col.header,
      minWidth: col.minWidth || 100,
      align: col.key === 'imageUrl' || col.key === 'students' ? 'center' as const : undefined,
      format: col.render,
    })),
    [allColumnDefs]
  );

  const columns = muiColumns;
  // Filter data based on search term and filters
  const filteredData = tableData.state.data.filter(parent => {
    // Search term filter
    const matchesSearch = !searchTerm.trim() || parent.name?.toLowerCase().includes(searchTerm.toLowerCase()) || parent.addressLine1?.toLowerCase().includes(searchTerm.toLowerCase()) || parent.addressLine2?.toLowerCase().includes(searchTerm.toLowerCase()) || parent.occupation?.toLowerCase().includes(searchTerm.toLowerCase()) || parent.workPlace?.toLowerCase().includes(searchTerm.toLowerCase());

    // Additional filters
    const matchesInstituteId = !filters.instituteId.trim() || parent.userIdByInstitute?.toLowerCase().includes(filters.instituteId.toLowerCase());
    const matchesName = !filters.name.trim() || parent.name?.toLowerCase().includes(filters.name.toLowerCase());
    const matchesPhone = !filters.phone.trim() || parent.phoneNumber?.toLowerCase().includes(filters.phone.toLowerCase());
    const matchesAddress = !filters.address.trim() || parent.addressLine1?.toLowerCase().includes(filters.address.toLowerCase()) || parent.addressLine2?.toLowerCase().includes(filters.address.toLowerCase());
    return matchesSearch && matchesInstituteId && matchesName && matchesPhone && matchesAddress;
  });

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      instituteId: '',
      name: '',
      phone: '',
      address: ''
    });
    setSelectedOccupation('');
    setSelectedWorkplace('');
    setEnrolledAfter('');
    setSortBy('name');
    setSortOrder('ASC');
    setSearchTerm('');
    setIncludeStudentInfo(false);
  };

  // Access control check
  if (!canViewParents) {
    return <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">
          You don't have permission to view parents. Only Institute Admins and Teachers can access this section.
        </p>
      </div>;
  }

  // Selection requirement check
  if (!selectedInstitute) {
    return <div className="flex flex-col items-center justify-center h-64 text-center">
        <Users className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Selection Required</h3>
        <p className="text-muted-foreground">
          Please select an institute to view parents.
        </p>
      </div>;
  }
  return <div className="h-screen flex flex-col p-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 md:w-8 md:h-8" />
            {selectedClass ? 'Class Parents' : 'Parents'}
          </h1>
          <div className="text-sm md:text-base text-muted-foreground">
            <p>
              Institute: <span className="font-medium">{selectedInstitute.name}</span>
              {selectedClass && <> • Class: <span className="font-medium">{selectedClass.name}</span></>}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto items-center">
          {/* Occupation Filter - Searchable Combobox */}
          <OccupationCombobox value={selectedOccupation} onValueChange={setSelectedOccupation} />

          {selectedOccupation && selectedOccupation !== 'all' && <Button variant="ghost" size="sm" onClick={() => setSelectedOccupation('')} className="w-full sm:w-auto">
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>}

          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4" />
                More Filters
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          <Button onClick={() => tableData.actions.refresh()} disabled={tableData.state.loading} variant="outline" size="sm" className="w-full sm:w-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${tableData.state.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View"><Table2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      

      

      {/* Filters */}
      <div className="mb-4">
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Advanced Filters</CardTitle>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                    Clear All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Institute ID</label>
                    <Input placeholder="Filter by Institute ID..." value={filters.instituteId} onChange={e => setFilters(prev => ({
                    ...prev,
                    instituteId: e.target.value
                  }))} />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input placeholder="Filter by name..." value={filters.name} onChange={e => setFilters(prev => ({
                    ...prev,
                    name: e.target.value
                  }))} />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input placeholder="Filter by phone..." value={filters.phone} onChange={e => setFilters(prev => ({
                    ...prev,
                    phone: e.target.value
                  }))} />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Address</label>
                    <Input placeholder="Filter by address..." value={filters.address} onChange={e => setFilters(prev => ({
                    ...prev,
                    address: e.target.value
                  }))} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Workplace</label>
                    <Input placeholder="Filter by workplace..." value={selectedWorkplace} onChange={e => setSelectedWorkplace(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enrolled After</label>
                    <Input type="date" placeholder="Filter by enrollment date..." value={enrolledAfter} onChange={e => setEnrolledAfter(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="occupation">Occupation</SelectItem>
                        <SelectItem value="workplace">Workplace</SelectItem>
                        <SelectItem value="dateOfBirth">Date of Birth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sort Order</label>
                    <Select value={sortOrder} onValueChange={value => setSortOrder(value as 'ASC' | 'DESC')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sort order..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="ASC">Ascending</SelectItem>
                        <SelectItem value="DESC">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Include Children Info</label>
                    <div className="flex items-center space-x-2 h-10 px-3 border rounded-md bg-background">
                      <Checkbox id="includeStudentInfoFilter" checked={includeStudentInfo} onCheckedChange={checked => setIncludeStudentInfo(checked === true)} />
                      <Label htmlFor="includeStudentInfoFilter" className="text-sm cursor-pointer">
                        Show Children Details
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Parents Table / Card View */}
      <div className="flex-1 min-h-0">
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 gap-4 overflow-auto">
            {(showAllParentCards ? filteredData : filteredData.slice(0, CARD_INITIAL_SHOW)).map(parent => {
              const parentKey = parent.id || parent.name;
              const childrenCount = parent.students?.length || parent.children?.length || 0;
              const isExpanded = expandedParentId === parentKey;
              return (
                <Card key={parentKey} className="hover:shadow-md transition-shadow">
                  <div className="p-4 flex items-center gap-3">
                    {/* Avatar */}
                    <Avatar
                      className="h-12 w-12 shrink-0 border-2 border-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        if (parent.imageUrl) {
                          setImagePreview({ isOpen: true, url: getImageUrl(parent.imageUrl), title: parent.name });
                        }
                      }}
                    >
                      <AvatarImage src={getImageUrl(parent.imageUrl)} alt={parent.name} className="object-cover" />
                      <AvatarFallback className="bg-muted"><User className="h-5 w-5" /></AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">
                        {parent.nameWithInitials || parent.name_with_initials || parent.name || 'N/A'}
                      </p>
                      {parent.phoneNumber && <p className="text-xs text-muted-foreground truncate">{parent.phoneNumber}</p>}
                      {parent.email && <p className="text-xs text-muted-foreground truncate">{parent.email}</p>}
                      {childrenCount > 0 && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {childrenCount} {childrenCount === 1 ? 'Child' : 'Children'}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 ml-auto">
                      {/* View Children */}
                      <Button
                        size="sm"
                        variant="outline"
                        title="View Children"
                        onClick={() => setChildrenDialog({ isOpen: true, parent, children: parent.students || parent.children || [] })}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {/* Expand */}
                      <button
                        onClick={() => setExpandedParentId(isExpanded ? null : parentKey)}
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t pt-3 space-y-2">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {parent.occupation && <p><span className="font-medium text-foreground">Occupation:</span> {parent.occupation}</p>}
                        {parent.workPlace && <p><span className="font-medium text-foreground">Workplace:</span> {parent.workPlace}</p>}
                        {parent.addressLine1 && <p><span className="font-medium text-foreground">Address:</span> {parent.addressLine1}{parent.addressLine2 ? `, ${parent.addressLine2}` : ''}</p>}
                        {parent.dateOfBirth && <p><span className="font-medium text-foreground">Date of Birth:</span> {new Date(parent.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                      </div>
                      {childrenCount > 0 && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <div className="flex -space-x-2">
                            {(parent.students || parent.children || []).slice(0, 4).map((child: any, idx: number) => {
                              const rawImageUrl = child?.instituteUserImageUrl || child?.profileImageUrl || child?.imageUrl || child?.user?.imageUrl;
                              return (
                                <Avatar key={idx} className="h-7 w-7 border-2 border-background ring-1 ring-primary/20">
                                  <AvatarImage src={rawImageUrl ? getImageUrl(rawImageUrl) : ''} alt={child.name} />
                                  <AvatarFallback className="bg-muted text-xs font-medium">{child.name?.charAt(0) || 'C'}</AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {childrenCount > 4 && (
                              <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-bold">+{childrenCount - 4}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
            {filteredData.length > CARD_INITIAL_SHOW && (
              <Button variant="outline" className="w-full" onClick={() => setShowAllParentCards(v => !v)}>
                {showAllParentCards ? `Show less` : `Show all ${filteredData.length} parents`}
              </Button>
            )}
          </div>
        ) : (
          <MUITable title={selectedClass ? 'Class Parents' : 'Parents'} columns={columns} data={filteredData} page={tableData.pagination.page} rowsPerPage={tableData.pagination.limit} totalCount={tableData.pagination.totalCount} onPageChange={tableData.actions.setPage} onRowsPerPageChange={tableData.actions.setLimit} rowsPerPageOptions={tableData.availableLimits} allowAdd={false} allowEdit={false} allowDelete={false} />
        )}
      </div>

      <ImagePreviewModal isOpen={imagePreview.isOpen} onClose={() => setImagePreview({
      isOpen: false,
      url: '',
      title: ''
    })} imageUrl={imagePreview.url} title={imagePreview.title} />

      {/* Children Details Dialog */}
      <Dialog open={childrenDialog.isOpen} onOpenChange={open => !open && setChildrenDialog({
      isOpen: false,
      parent: null,
      children: []
    })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Children of {childrenDialog.parent?.nameWithInitials || childrenDialog.parent?.name_with_initials || childrenDialog.parent?.name || 'Parent'}
            </DialogTitle>
            <DialogDescription>
              {childrenDialog.children.length} {childrenDialog.children.length === 1 ? 'child' : 'children'} found
            </DialogDescription>
          </DialogHeader>
          
          {childrenDialog.children.length > 0 ? <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childrenDialog.children.map((child: any, index: number) => {
              const rawImageUrl = child?.instituteUserImageUrl || child?.profileImageUrl || child?.imageUrl || child?.user?.imageUrl;
              const imageSrc = rawImageUrl ? getImageUrl(rawImageUrl) : '';
              return <TableRow key={child.userId || index}>
                        <TableCell>
                          <button type="button" className={cn('group inline-flex', imageSrc ? 'cursor-pointer' : 'cursor-default')} onClick={() => {
                    if (!imageSrc) return;
                    setImagePreview({
                      isOpen: true,
                      url: imageSrc,
                      title: child.name
                    });
                  }} aria-label={imageSrc ? `Open ${child.name} photo` : `${child.name} photo unavailable`}>
                            <div className="h-14 w-14 rounded-xl overflow-hidden border border-border bg-muted shadow-sm transition-transform group-hover:scale-105">
                              <SafeImage src={imageSrc} alt={`${child.name} student photo`} className="h-full w-full object-cover" fallback={<div className="h-full w-full grid place-items-center text-muted-foreground">
                                    <User className="h-6 w-6" />
                                  </div>} />
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {child.studentId || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button 
                            className="font-medium hover:text-primary hover:underline transition-colors text-left"
                            onClick={() => {
                              if (selectedInstitute && (child.studentId || child.userId || child.user_id)) {
                                navigate(`/institute/${selectedInstitute.id}/student/${child.studentId || child.userId || child.user_id}/profile`);
                              }
                            }}
                          >
                            {child.nameWithInitials || child.name_with_initials || child.name || 'N/A'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-primary border border-primary/20">
                            {child.relationshipType || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {child.phoneNumber || 'N/A'}
                          </div>
                        </TableCell>
                      </TableRow>;
            })}
                </TableBody>
            </Table> : <div className="text-center py-8 text-muted-foreground">
              No children information available
            </div>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default Parents;