import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DurationInputProps {
  /** Value stored as total seconds (null / undefined = empty) */
  value: number | undefined | null;
  onChange: (seconds: number | undefined) => void;
  disabled?: boolean;
  /** Small label shown above the group */
  label?: string;
  className?: string;
}

function secsToParts(total: number): { h: number; m: number; s: number } {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return { h, m, s };
}

/**
 * Friendly duration input: separate H / M / S number boxes.
 * Stores and emits total seconds. Backend never changes — it stores seconds.
 */
const DurationInput: React.FC<DurationInputProps> = ({
  value,
  onChange,
  disabled,
  label = 'Duration',
  className = '',
}) => {
  const init = value != null && value > 0 ? secsToParts(value) : { h: 0, m: 0, s: 0 };
  const [h, setH] = useState(init.h);
  const [m, setM] = useState(init.m);
  const [s, setS] = useState(init.s);

  // Sync when value changes externally (e.g. form load)
  useEffect(() => {
    if (value != null && value > 0) {
      const p = secsToParts(value);
      setH(p.h); setM(p.m); setS(p.s);
    } else {
      setH(0); setM(0); setS(0);
    }
  }, [value]);

  const emit = (hv: number, mv: number, sv: number) => {
    const total = hv * 3600 + mv * 60 + sv;
    onChange(total > 0 ? total : undefined);
  };

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, isNaN(v) ? 0 : v));

  const handleH = (raw: string) => {
    const v = clamp(parseInt(raw, 10), 99);
    setH(v); emit(v, m, s);
  };
  const handleM = (raw: string) => {
    const v = clamp(parseInt(raw, 10), 59);
    setM(v); emit(h, v, s);
  };
  const handleS = (raw: string) => {
    const v = clamp(parseInt(raw, 10), 59);
    setS(v); emit(h, m, v);
  };

  const total = h * 3600 + m * 60 + s;

  return (
    <div className={className}>
      {label && <Label className="text-xs mb-1.5 block">{label}</Label>}
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col items-center gap-0.5 flex-1">
          <Input
            type="number"
            min={0}
            max={99}
            value={h || ''}
            placeholder="0"
            disabled={disabled}
            onChange={e => handleH(e.target.value)}
            className="h-8 text-xs text-center px-1"
          />
          <span className="text-[10px] text-muted-foreground">hrs</span>
        </div>
        <span className="text-muted-foreground font-bold pb-3">:</span>
        <div className="flex flex-col items-center gap-0.5 flex-1">
          <Input
            type="number"
            min={0}
            max={59}
            value={m || ''}
            placeholder="0"
            disabled={disabled}
            onChange={e => handleM(e.target.value)}
            className="h-8 text-xs text-center px-1"
          />
          <span className="text-[10px] text-muted-foreground">min</span>
        </div>
        <span className="text-muted-foreground font-bold pb-3">:</span>
        <div className="flex flex-col items-center gap-0.5 flex-1">
          <Input
            type="number"
            min={0}
            max={59}
            value={s || ''}
            placeholder="0"
            disabled={disabled}
            onChange={e => handleS(e.target.value)}
            className="h-8 text-xs text-center px-1"
          />
          <span className="text-[10px] text-muted-foreground">sec</span>
        </div>
      </div>
      {total > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1">
          = {total.toLocaleString()} seconds
          {h > 0 ? ` (${h}h ${m}m ${s}s)` : m > 0 ? ` (${m}m ${s}s)` : ''}
        </p>
      )}
    </div>
  );
};

export default DurationInput;
