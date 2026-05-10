/**
 * Frontend timezone utilities for Sri Lanka (Asia/Colombo, UTC+5:30).
 * Use these instead of new Date().toISOString().split('T')[0] which returns UTC date
 * and will return yesterday's date after 18:30 UTC (midnight Colombo).
 */

const COLOMBO = 'Asia/Colombo';

const COLOMBO_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: COLOMBO,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

const COLOMBO_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: COLOMBO,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isMysqlDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/.test(value.trim());
}

function formatMysqlDateTime(value: string): string {
  const cleaned = value.trim().replace('T', ' ');
  const [datePart, timePart = ''] = cleaned.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);

  if (!year || !month || !day) return value;

  if (!timePart) {
    return `${String(day).padStart(2, '0')} ${MONTH_NAMES[month - 1] ?? '—'} ${year}`;
  }

  const [hourStr = '0', minuteStr = '0', secondStr = '0'] = timePart.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr.split('.')[0]);
  const isPm = hour >= 12;
  const displayHour = hour % 12 || 12;

  return `${String(day).padStart(2, '0')} ${MONTH_NAMES[month - 1] ?? '—'} ${year}, ${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
}

function parseDateValue(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;

  const normalized = value.replace(' ', 'T');
  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Returns today's date in YYYY-MM-DD format using Sri Lanka timezone.
 * Safe to use at any time of day — never drifts to yesterday/tomorrow due to UTC offset.
 */
export function getSriLankaDate(date?: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: COLOMBO }).format(date ?? new Date());
}

export function formatSriLankaDate(value?: string | number | Date | null): string {
  if (typeof value === 'string' && isMysqlDateTime(value)) {
    return formatMysqlDateTime(value).split(',')[0];
  }
  const date = parseDateValue(value);
  if (!date) return typeof value === 'string' && value.trim() ? value : '—';
  return new Intl.DateTimeFormat('en-GB', COLOMBO_DATE_OPTIONS).format(date);
}

export function formatSriLankaTime(value?: string | number | Date | null): string {
  if (typeof value === 'string' && isMysqlDateTime(value)) {
    const formatted = formatMysqlDateTime(value);
    const timePart = formatted.includes(', ') ? formatted.split(', ')[1] : formatted;
    return timePart || value;
  }
  const date = parseDateValue(value);
  if (!date) return typeof value === 'string' && value.trim() ? value : '—';
  return new Intl.DateTimeFormat('en-LK', COLOMBO_TIME_OPTIONS).format(date);
}

export function formatSriLankaDateTime(value?: string | number | Date | null): string {
  if (typeof value === 'string' && isMysqlDateTime(value)) {
    return formatMysqlDateTime(value);
  }
  const date = parseDateValue(value);
  if (!date) return typeof value === 'string' && value.trim() ? value : '—';
  return new Intl.DateTimeFormat('en-LK', { ...COLOMBO_DATE_OPTIONS, hour: '2-digit', minute: '2-digit' }).format(date);
}
