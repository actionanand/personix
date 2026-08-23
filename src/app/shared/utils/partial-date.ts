const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface PartialDateParts {
  readonly year: string;
  readonly month: string;
  readonly day: string;
}

export function buildPartialDate(parts: PartialDateParts): string {
  const year = parts.year.trim();
  const month = parts.month.trim();
  const rawDay = parts.day.trim();
  const day = rawDay ? rawDay.padStart(2, '0') : '';
  if (!/^\d{4}$/.test(year)) return '';
  if (Number(year) < 1000) return '';
  if (!month) return day ? '' : year;
  if (!/^(0[1-9]|1[0-2])$/.test(month)) return '';
  if (!day) return `${year}-${month}`;
  if (!/^(0[1-9]|[12]\d|3[01])$/.test(day)) return '';
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return '';
  }
  return `${year}-${month}-${day}`;
}

export function partialDateSortKey(value: string, usePeriodEnd = false): string {
  const [year = '0000', month, day] = value.split('-');
  return `${year}-${month ?? (usePeriodEnd ? '12' : '01')}-${day ?? (usePeriodEnd ? '31' : '01')}`;
}

export function formatPartialDate(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year) return '';
  if (!month) return year;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return value;
  return day ? `${monthName} ${Number(day)}, ${year}` : `${monthName} ${year}`;
}
