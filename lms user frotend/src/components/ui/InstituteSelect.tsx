import React, { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Search } from 'lucide-react';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';

export interface InstituteOption {
  id: string;
  name: string;
  code?: string;
  shortName?: string;
}

interface InstituteSelectProps {
  value: string;
  onChange: (id: string, name: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Smart institute dropdown.
 * - SUPERADMIN: shows a debounced search input + fetches GET /institutes?search=q
 * - Other roles: shows the institutes already loaded in AuthContext (no extra API call)
 */
const InstituteSelect: React.FC<InstituteSelectProps> = ({
  value,
  onChange,
  label = 'Institute',
  placeholder = 'Select institute…',
  required = false,
  disabled = false,
  className,
}) => {
  const { user } = useAuth();
  const normalizedRole = `${user?.role || user?.userType || ''}`.toUpperCase();
  const isSuperAdmin = ['SYSTEMADMIN', 'SYSTEM_ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(normalizedRole);

  const contextInstitutes: InstituteOption[] = (user?.institutes || []).map(i => ({
    id: i.id,
    name: i.name,
    code: i.code,
    shortName: i.shortName,
  }));

  // SuperAdmin search state
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<InstituteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await enhancedCachedClient.get<any>(
          '/institutes',
          { search, page: 1, limit: 30 },
          { ttl: 30, userId: user?.id }
        );
        const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
        setResults(items.map((i: any) => ({
          id: i.id ?? i.instituteId,
          name: i.instituteName ?? i.name,
          code: i.instituteCode ?? i.code,
        })));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, isSuperAdmin]);

  const options = isSuperAdmin ? results : contextInstitutes;
  const selectedOption = options.find(o => o.id === value);

  if (isSuperAdmin) {
    return (
      <div className={`space-y-1 ${className ?? ''}`}>
        {label && (
          <Label className="text-sm font-medium">
            {label}{required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search institutes…"
            className="pl-8 text-sm"
            disabled={disabled}
          />
        </div>
        {loading && <Skeleton className="h-10 w-full" />}
        {!loading && options.length > 0 && (
          <div className="border rounded-md max-h-48 overflow-y-auto">
            {options.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id, o.name); setSearch(o.name); setResults([]); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${value === o.id ? 'bg-accent' : ''}`}
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{o.name}</span>
                {o.code && <span className="text-xs text-muted-foreground ml-auto shrink-0">{o.code}</span>}
              </button>
            ))}
          </div>
        )}
        {selectedOption && results.length === 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 px-1">
            <Building2 className="h-3 w-3" />
            Selected: <span className="font-medium">{selectedOption.name}</span>
          </div>
        )}
      </div>
    );
  }

  // Non-superadmin: simple select from context institutes
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {label && (
        <Label className="text-sm font-medium">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={id => {
          const opt = options.find(o => o.id === id);
          if (opt) onChange(opt.id, opt.name);
        }}
        disabled={disabled || options.length === 0}
      >
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={options.length === 0 ? 'No institutes available' : placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}{o.code ? ` (${o.code})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default InstituteSelect;
