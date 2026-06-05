/** UTC midnight of the first forecast `init_time` in the dynamical.org
 * ECMWF store. Each index along `init_time` is one day later than the
 * previous one. Ported from the upstream example. */
export const ECMWF_INIT_TIME_ORIGIN = new Date("2024-04-01T00:00:00Z");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function dateFromInitTimeIdx(idx: number): Date {
  return new Date(ECMWF_INIT_TIME_ORIGIN.getTime() + idx * MS_PER_DAY);
}

export function isoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Lead-time schedule in hours from init_time. 3-hourly from 0..144 h,
 * then 6-hourly to 360 h. 85 entries total. */
export const ECMWF_LEAD_TIME_HOURS: readonly number[] = (() => {
  const hours: number[] = [];
  for (let h = 0; h <= 144; h += 3) hours.push(h);
  for (let h = 150; h <= 360; h += 6) hours.push(h);
  return hours;
})();

export function leadHoursLabel(idx: number): string {
  const h = ECMWF_LEAD_TIME_HOURS[idx];
  if (h == null) return `idx ${idx}`;
  return `+${h} h`;
}

export function memberLabel(idx: number): string {
  return idx === 0 ? "0 (control)" : `member ${idx}`;
}
