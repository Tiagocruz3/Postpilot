/**
 * Helpers for the bulk variant scheduler: turn a start date + chosen weekdays +
 * times into a concrete list of future posting datetimes.
 *
 * All dates are computed in the user's local timezone (Date is local); callers
 * convert to UTC with `.toISOString()` before persisting to `scheduled_at`.
 */

export const WEEKDAYS: Array<{ value: number; short: string; label: string }> = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 0, short: 'Sun', label: 'Sunday' },
]

export type ScheduleSlotInput = {
  /** Local calendar date to start from, as 'yyyy-mm-dd'. */
  startDate: string
  /** JS getDay() values (0=Sun..6=Sat) the user selected. */
  weekdays: number[]
  /** Local times of day as 'HH:mm'. One or more slots per active day. */
  times: string[]
  /** How many datetimes to produce. */
  count: number
}

/**
 * Returns up to `count` future datetimes that fall on the chosen weekdays at the
 * chosen times, in chronological order, starting on/after `startDate`. Slots in
 * the past (relative to now) are skipped so nothing schedules instantly.
 */
export function computeScheduleSlots({ startDate, weekdays, times, count }: ScheduleSlotInput): Date[] {
  const days = Array.from(new Set(weekdays)).filter((d) => d >= 0 && d <= 6)
  const slotTimes = Array.from(new Set(times)).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).sort()
  if (days.length === 0 || slotTimes.length === 0 || count <= 0) return []

  const parts = startDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return []
  const [year, month, day] = parts
  const cursor = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (Number.isNaN(cursor.getTime())) return []

  const now = Date.now()
  const result: Date[] = []
  // Guard against infinite loops; ~2 years of days is plenty for any count.
  for (let i = 0; i < 730 && result.length < count; i += 1) {
    if (days.includes(cursor.getDay())) {
      for (const t of slotTimes) {
        if (result.length >= count) break
        const [hh, mm] = t.split(':').map(Number)
        const slot = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), hh, mm, 0, 0)
        if (slot.getTime() > now) result.push(slot)
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}
