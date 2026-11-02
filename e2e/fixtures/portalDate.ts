import type { CalendarDate } from '../pages/AdminSubjectPage';

export function portalDate(offset = 0): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Etc/GMT+5', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find(item => item.type === type)?.value;
    if (!value) throw new Error(`Cannot determine portal calendar ${type}.`);
    return Number(value);
  };
  const date = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + offset));
  return {
    day: String(date.getUTCDate()), month: String(date.getUTCMonth() + 1),
    year: String(date.getUTCFullYear()),
  };
}

export function addCalendarMonths(date: CalendarDate, months: number): Date {
  const targetMonth = Number(date.month) - 1 + months;
  const lastDay = new Date(Date.UTC(Number(date.year), targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(Number(date.year), targetMonth, Math.min(Number(date.day), lastDay)));
}
