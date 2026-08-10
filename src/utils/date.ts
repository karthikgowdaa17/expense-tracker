import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addYears,
  subYears,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  isSameMonth,
  isSameYear,
  isBefore,
  isAfter,
  isWithinInterval,
  getDaysInMonth,
  getMonth,
  getYear,
  setMonth,
  setYear,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  eachMonthOfInterval,
  isValid,
  parse,
} from 'date-fns';

export const DATE_FORMAT = 'yyyy-MM-dd';
export const DISPLAY_DATE_FORMAT = 'MMM dd, yyyy';
export const MONTH_YEAR_FORMAT = 'MMMM yyyy';
export const MONTH_FORMAT = 'MMMM';
export const YEAR_FORMAT = 'yyyy';

// Re-export date-fns functions
export { isSameMonth, isSameYear, differenceInMonths };

export function formatDate(date: Date | string, formatStr = DATE_FORMAT): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return format(d, formatStr);
}

export function formatDisplayDate(date: Date | string): string {
  return formatDate(date, DISPLAY_DATE_FORMAT);
}

export function formatMonthYear(date: Date | string): string {
  return formatDate(date, MONTH_YEAR_FORMAT);
}

export function formatMonth(date: Date | string): string {
  return formatDate(date, MONTH_FORMAT);
}

export function formatYear(date: Date | string): string {
  return formatDate(date, YEAR_FORMAT);
}

export function getCurrentMonthStart(): Date {
  return startOfMonth(new Date());
}

export function getCurrentMonthEnd(): Date {
  return endOfMonth(new Date());
}

export function getCurrentYearStart(): Date {
  return startOfYear(new Date());
}

export function getCurrentYearEnd(): Date {
  return endOfYear(new Date());
}

export function getMonthStart(date: Date): Date {
  return startOfMonth(date);
}

export function getMonthEnd(date: Date): Date {
  return endOfMonth(date);
}

export function getYearStart(date: Date): Date {
  return startOfYear(date);
}

export function getYearEnd(date: Date): Date {
  return endOfYear(date);
}

export function getPreviousMonth(date: Date): Date {
  return subMonths(date, 1);
}

export function getNextMonth(date: Date): Date {
  return addMonths(date, 1);
}

export function getPreviousYear(date: Date): Date {
  return subYears(date, 1);
}

export function getNextYear(date: Date): Date {
  return addYears(date, 1);
}

export function getMonthRange(date: Date): { start: Date; end: Date } {
  return {
    start: getMonthStart(date),
    end: getMonthEnd(date),
  };
}

export function getYearRange(date: Date): { start: Date; end: Date } {
  return {
    start: getYearStart(date),
    end: getYearEnd(date),
  };
}

export function getFinancialYearRange(date: Date): { start: Date; end: Date } {
  const year = getYear(date);
  const month = getMonth(date);
  
  if (month >= 3) {
    return {
      start: new Date(year, 3, 1),
      end: new Date(year + 1, 2, 31),
    };
  } else {
    return {
      start: new Date(year - 1, 3, 1),
      end: new Date(year, 2, 31),
    };
  }
}

export function getFinancialYearLabel(date: Date): string {
  const { start, end } = getFinancialYearRange(date);
  return `FY ${getYear(start)}-${String(getYear(end)).slice(-2)}`;
}

export function isCurrentMonth(date: Date): boolean {
  return isSameMonth(date, new Date());
}

export function isCurrentYear(date: Date): boolean {
  return isSameYear(date, new Date());
}

export function getDaysInMonthForDate(date: Date): number {
  return getDaysInMonth(date);
}

export function getElapsedDaysInMonth(date: Date): number {
  const today = new Date();
  if (isSameMonth(date, today) && isSameYear(date, today)) {
    return differenceInDays(today, startOfMonth(date)) + 1;
  }
  return getDaysInMonth(date);
}

export function getMonthsInRange(start: Date, end: Date): Date[] {
  return eachMonthOfInterval({ start: startOfMonth(start), end: endOfMonth(end) });
}

export function getDaysInRange(start: Date, end: Date): Date[] {
  return eachDayOfInterval({ start: startOfDay(start), end: endOfDay(end) });
}

export function parseDateString(dateStr: string): Date | null {
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createDate(year: number, month: number, day = 1): Date {
  return new Date(year, month, day);
}

export function getMonthKey(date: Date): string {
  return `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): Date {
  const [year, month] = key.split('-').map(Number);
  return createDate(year, month - 1);
}

export function generateMonthOptions(startYear = 2020, endYear?: number): { value: string; label: string }[] {
  const currentYear = getYear(new Date());
  const end = endYear || currentYear + 2;
  const options: { value: string; label: string }[] = [];
  
  for (let year = startYear; year <= end; year++) {
    for (let month = 0; month < 12; month++) {
      const date = createDate(year, month);
      options.push({
        value: getMonthKey(date),
        label: formatMonthYear(date),
      });
    }
  }
  
  return options.reverse();
}

export function generateYearOptions(startYear = 2020, endYear?: number): { value: string; label: string }[] {
  const currentYear = getYear(new Date());
  const end = endYear || currentYear + 2;
  const options: { value: string; label: string }[] = [];
  
  for (let year = end; year >= startYear; year--) {
    options.push({
      value: String(year),
      label: String(year),
    });
  }
  
  return options;
}