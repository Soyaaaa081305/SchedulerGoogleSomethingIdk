import { DAY_TO_RRULE, nextDateForDay, type Day } from "@/lib/days";

export interface IcsEvent {
  id: string;
  courseName: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  room: string | null;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "08:30" -> "083000" */
function compactTime(time: string): string {
  return time.replace(":", "") + "00";
}

function untilStamp(semesterEndIso: string | null): string {
  const base = semesterEndIso ? new Date(semesterEndIso) : new Date(Date.now() + 120 * 86400000);
  const safe = Number.isNaN(base.getTime()) ? new Date(Date.now() + 120 * 86400000) : base;
  return safe.toISOString().slice(0, 10).replace(/-/g, "") + "T235959Z";
}

/**
 * Builds a valid RFC 5545 calendar (weekly recurring events) that can be
 * imported into Google Calendar / Apple Calendar / Outlook without any sync.
 */
export function schedulesToICS(
  schedules: IcsEvent[],
  opts: { timezone: string; semesterEnd: string | null; now?: Date }
): string {
  const now = opts.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scheduler MCL//Schedule Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${opts.timezone}`,
  ];

  for (const s of schedules) {
    if (s.daysOfWeek.length === 0) continue;
    // Anchor DTSTART on the next occurrence of the first day.
    const anchor = nextDateForDay(s.daysOfWeek[0] as Day, opts.timezone, now);
    const byday = s.daysOfWeek
      .map((d) => DAY_TO_RRULE[d as Day])
      .filter(Boolean)
      .join(",");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@scheduler-mcl`,
      `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;TZID=${opts.timezone}:${anchor.replace(/-/g, "")}T${compactTime(s.startTime)}`,
      `DTEND;TZID=${opts.timezone}:${anchor.replace(/-/g, "")}T${compactTime(s.endTime)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${untilStamp(opts.semesterEnd)}`,
      `SUMMARY:${escapeText(s.courseName)}`
    );
    if (s.room) lines.push(`LOCATION:${escapeText(s.room)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
