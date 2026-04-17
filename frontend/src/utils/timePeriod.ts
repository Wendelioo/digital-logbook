export type TimePeriodValue = '' | 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'custom';

export interface TimePeriodOption {
  value: TimePeriodValue;
  label: string;
}

export const TIME_PERIOD_OPTIONS: TimePeriodOption[] = [
  { value: '', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getDateRangeForPeriod = (
  period: TimePeriodValue,
  baseDate: Date = new Date(),
): { from: string; to: string } | null => {
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  switch (period) {
    case 'today': {
      const date = formatDateForInput(today);
      return { from: date, to: date };
    }
    case 'yesterday': {
      const yesterday = addDays(today, -1);
      const date = formatDateForInput(yesterday);
      return { from: date, to: date };
    }
    case 'last_7_days': {
      const from = formatDateForInput(addDays(today, -6));
      const to = formatDateForInput(today);
      return { from, to };
    }
    case 'last_30_days': {
      const from = formatDateForInput(addDays(today, -29));
      const to = formatDateForInput(today);
      return { from, to };
    }
    case 'this_month': {
      const from = formatDateForInput(new Date(today.getFullYear(), today.getMonth(), 1));
      const to = formatDateForInput(today);
      return { from, to };
    }
    case 'last_month': {
      const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfLastMonth = addDays(firstDayOfCurrentMonth, -1);
      const firstDayOfLastMonth = new Date(lastDayOfLastMonth.getFullYear(), lastDayOfLastMonth.getMonth(), 1);
      return {
        from: formatDateForInput(firstDayOfLastMonth),
        to: formatDateForInput(lastDayOfLastMonth),
      };
    }
    case 'custom':
    case '':
    default:
      return null;
  }
};
