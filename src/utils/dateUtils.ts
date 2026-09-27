export function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  if (h === 24) return 1440;
  return (h || 0) * 60 + (m || 0);
}

export function endTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  if (timeStr === '00:00' || timeStr === '24:00') return 1440;
  return timeToMinutes(timeStr);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${padZero(h)}:${padZero(m)}`;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  return `${y}-${m}-${d}`;
}

export function parseDateISO(isoStr: string): Date {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // Noon to avoid timezone boundary shifts
}

export function formatHumanDate(isoStr: string, locale: string = 'en-US'): string {
  try {
    const d = parseDateISO(isoStr);
    return d.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

export function formatFullHumanDate(isoStr: string, locale: string = 'en-US'): string {
  try {
    const d = parseDateISO(isoStr);
    return d.toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

export function getTodayISO(): string {
  return formatDateISO(new Date());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addDaysToISO(isoStr: string, days: number): string {
  const d = parseDateISO(isoStr);
  return formatDateISO(addDays(d, days));
}

// Get the Monday of the week for a given date
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // day 0 = Sunday, 1 = Monday. We want Monday as start of week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDaysInWeek(startDate: Date): Date[] {
  const monday = getStartOfWeek(startDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(monday, i));
  }
  return days;
}

export function getMonthDays(year: number, month: number): { date: Date; inMonth: boolean }[] {
  // month: 0-11
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const days: { date: Date; inMonth: boolean }[] = [];
  
  // Backtrack to Monday of first week
  const startDay = firstDayOfMonth.getDay();
  const prevDaysCount = startDay === 0 ? 6 : startDay - 1;
  for (let i = prevDaysCount; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    days.push({ date: d, inMonth: false });
  }
  
  // Current month days
  for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true });
  }
  
  // Forward track to complete last week of month (42 cells total for 6 rows)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), inMonth: false });
  }
  
  return days;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isCancellationAllowed(
  appointmentDate: string,
  appointmentStartTime: string,
  cancellationPolicyHours: number,
  allowUnrestrictedCancellation: boolean
): { allowed: boolean; hoursRemaining: number; cutoffHours: number } {
  if (allowUnrestrictedCancellation || cancellationPolicyHours <= 0) {
    return { allowed: true, hoursRemaining: 9999, cutoffHours: 0 };
  }

  const [year, month, day] = appointmentDate.split('-').map(Number);
  const [hours, minutes] = appointmentStartTime.split(':').map(Number);
  
  const apptTime = new Date(year, month - 1, day, hours, minutes, 0).getTime();
  const now = new Date().getTime();
  
  const diffMs = apptTime - now;
  const hoursRemaining = diffMs / (1000 * 60 * 60);

  return {
    allowed: hoursRemaining >= cancellationPolicyHours,
    hoursRemaining: Math.max(0, Math.round(hoursRemaining * 10) / 10),
    cutoffHours: cancellationPolicyHours,
  };
}

export function isUpcomingBirthday(dateOfBirth?: string): { isSoon: boolean; daysAway: number; formattedAge?: number } {
  if (!dateOfBirth) return { isSoon: false, daysAway: 999 };
  try {
    const today = new Date();
    const [bYear, bMonth, bDay] = dateOfBirth.split('-').map(Number);
    const thisYearBday = new Date(today.getFullYear(), bMonth - 1, bDay);
    
    // If birthday has passed this year, check next year
    let nextBday = thisYearBday;
    if (thisYearBday.getTime() < today.setHours(0, 0, 0, 0)) {
      nextBday = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
    }
    
    const diffTime = nextBday.getTime() - today.getTime();
    const daysAway = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const age = nextBday.getFullYear() - bYear;
    
    return {
      isSoon: daysAway >= 0 && daysAway <= 7,
      daysAway,
      formattedAge: age,
    };
  } catch {
    return { isSoon: false, daysAway: 999 };
  }
}
