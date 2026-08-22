import type { Day } from "@/lib/days";
import { DAYS, formatTime12h, minutesNowInTz, weekdayInTz } from "@/lib/days";
import type { ScheduleDTO } from "@/lib/types";

export interface TimeRangeLike {
  courseName: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
}

function daysOverlap(a: string[], b: string[]): boolean {
  return a.some((d) => b.includes(d));
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Merges duplicate rows extracted by the AI (same course at the same time,
 * listed once per day) by unioning their day lists.
 */
export function mergeDuplicateRows<T extends TimeRangeLike>(rows: T[]): T[] {
  const merged: T[] = [];
  for (const row of rows) {
    const twin = merged.find(
      (m) =>
        m.courseName.trim().toLowerCase() === row.courseName.trim().toLowerCase() &&
        m.startTime === row.startTime &&
        m.endTime === row.endTime
    );
    if (twin) {
      for (const d of row.daysOfWeek) {
        if (!twin.daysOfWeek.includes(d)) twin.daysOfWeek = [...twin.daysOfWeek, d];
      }
    } else {
      merged.push({ ...row, daysOfWeek: [...row.daysOfWeek] });
    }
  }
  return merged;
}

/**
 * Conflicts among the given rows themselves — returns human-readable messages.
 */
export function conflictsWithinRows(rows: TimeRangeLike[]): string[] {
  const messages: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (!timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;
      const shared = a.daysOfWeek.filter((d) => b.daysOfWeek.includes(d));
      if (shared.length === 0) continue;
      messages.push(
        `"${a.courseName}" and "${b.courseName}" overlap on ${shared.join(", ")} (${a.startTime}–${a.endTime}).`
      );
    }
  }
  return messages;
}

/**
 * Conflicts between candidate rows and the user's saved schedule.
 */
export function conflictsWithExisting(
  candidates: TimeRangeLike[],
  existing: Array<TimeRangeLike & { id?: string }>
): string[] {
  const messages: string[] = [];
  for (const c of candidates) {
    for (const e of existing) {
      if (!timesOverlap(c.startTime, c.endTime, e.startTime, e.endTime)) continue;
      const shared = c.daysOfWeek.filter((d) => e.daysOfWeek.includes(d));
      if (shared.length === 0) continue;
      messages.push(
        `"${c.courseName}" overlaps "${e.courseName}" on ${shared.join(", ")} (${e.startTime}–${e.endTime}).`
      );
      break;
    }
  }
  return messages;
}

/** True when an extracted row is already on the schedule (same class, same time, shared day). */
export function isDuplicateOfExisting(row: TimeRangeLike, existing: ScheduleDTO[]): boolean {
  const name = row.courseName.trim().toLowerCase();
  return existing.some(
    (e) =>
      e.courseName.trim().toLowerCase() === name &&
      e.startTime === row.startTime &&
      e.endTime === row.endTime &&
      daysOverlap(e.daysOfWeek, row.daysOfWeek)
  );
}

export interface NextOccurrenceInfo {
  courseName: string;
  room: string | null;
  day: Day | null;
  startTime: string;
  endTime: string;
  /** Minutes until start (0 if it has already started). */
  minutesUntil: number;
  ongoing: boolean;
}

/**
 * The next (or currently running) class occurrence, computed in the user's
 * timezone. Pure aside from the injected `now`.
 */
export function nextOccurrenceInfo(
  schedules: ScheduleDTO[],
  timezone: string,
  now: Date = new Date()
): NextOccurrenceInfo | null {
  const todayIdx = DAYS.indexOf(weekdayInTz(timezone, now) as Day);
  const nowMin = minutesNowInTz(timezone, now);
  if (todayIdx < 0 || nowMin === null) return null;

  let best: { info: NextOccurrenceInfo; score: number } | null = null;

  for (const s of schedules) {
    const start = toMinutes(s.startTime);
    const end = toMinutes(s.endTime);
    if (start === null || end === null) continue;

    for (const rawDay of s.daysOfWeek) {
      const idx = DAYS.indexOf(rawDay as Day);
      if (idx < 0) continue;

      const dayShift = (idx - todayIdx + 7) % 7;
      const minutesUntil = dayShift * 1440 + start - nowMin;

      // Ongoing right now wins immediately.
      if (dayShift === 0 && nowMin >= start && nowMin < end) {
        return {
          courseName: s.courseName,
          room: s.room,
          day: rawDay as Day,
          startTime: s.startTime,
          endTime: s.endTime,
          minutesUntil: 0,
          ongoing: true,
        };
      }

      if (minutesUntil <= 0) continue;
      const score = minutesUntil;
      if (!best || score < best.score) {
        best = {
          score,
          info: {
            courseName: s.courseName,
            room: s.room,
            day: rawDay as Day,
            startTime: s.startTime,
            endTime: s.endTime,
            minutesUntil,
            ongoing: false,
          },
        };
      }
    }
  }

  return best?.info ?? null;
}

function toMinutes(time: string): number | null {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** "in 2h 05m" / "in 45m" / "starting now" style label. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "starting now";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `in ${m}m`;
  if (m === 0) return `in ${h}h`;
  return `in ${h}h ${String(m).padStart(2, "0")}m`;
}

export function describeNextOccurrence(info: NextOccurrenceInfo): string {
  const where = info.room ? ` · ${info.room}` : "";
  if (info.ongoing) {
    return `${info.courseName} is happening now${where} — ends ${formatTime12h(info.endTime)}.`;
  }
  const when = info.day ? `${formatDayLabel(info.day)} ${formatTime12h(info.startTime)}` : formatTime12h(info.startTime);
  return `Next up: ${info.courseName} · ${when}${where} · ${formatDuration(info.minutesUntil)}.`;
}

function formatDayLabel(day: Day): string {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
    DAYS.indexOf(day)
  ];
}
