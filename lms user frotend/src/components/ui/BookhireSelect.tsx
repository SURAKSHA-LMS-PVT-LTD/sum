import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck } from 'lucide-react';
import { transportApi, type AvailableBookhire } from '@/api/transport.api';

interface BookhireSelectProps {
  value: string;
  onChange: (id: string, label: string, bookhire: AvailableBookhire) => void;
  instituteId?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const displayLabel = (b: AvailableBookhire) =>
  [b.vehicleNumber, b.ownerName, b.routeDescription].filter(Boolean).join(' · ') || `Service #${b.id}`;

/**
 * Dropdown that lists available bookhire (transport) services.
 * Calls GET /api/bookhires/available
 */
const BookhireSelect: React.FC<BookhireSelectProps> = ({
  value,
  onChange,
  instituteId,
  label = 'Transport Service',
  placeholder = 'Select transport…',
  required = false,
  disabled = false,
  className,
}) => {
  const [bookhires, setBookhires] = useState<AvailableBookhire[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    transportApi.getAvailableBookhires({ limit: 100, instituteId })
      .then(res => {
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        setBookhires(items);
      })
      .catch(() => setBookhires([]))
      .finally(() => setLoading(false));
  }, [instituteId]);

  if (loading) return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {label && <Label className="text-sm font-medium">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>}
      <Skeleton className="h-10 w-full" />
    </div>
  );

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
          const b = bookhires.find(bh => String(bh.id) === id);
          if (b) onChange(id, displayLabel(b), b);
        }}
        disabled={disabled || bookhires.length === 0}
      >
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={bookhires.length === 0 ? 'No transports available' : placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {bookhires.map(b => (
            <SelectItem key={b.id} value={String(b.id)}>
              <div className="flex flex-col">
                <span>{displayLabel(b)}</span>
                {b.capacity && <span className="text-xs text-muted-foreground">Capacity: {b.capacity}</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default BookhireSelect;
