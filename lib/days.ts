export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type Day = (typeof DAYS)[number];

export const DAY_TO_RRULE: Record<Day, string> = {
  MON: "MO",
  TUE: "TU",
  WED: "WE",
  THU: "TH",
  FRI: "FR",
  SAT: "SA",
  SUN: "SU",
};

const DAY_ALIASES: Record<string, Day> = {
  M: "MON",
  MO: "MON",
  MON: "MON",
  MONDAY: "MON",
  MONDAYS: "MON",
  T: "TUE",
  TU: "TUE",
  TUE: "TUE",
  TUES: "TUE",
  TUESDAY: "TUE",
  TUESDAYS: "TUE",
  W: "WED",
  WE: "WED",
  WED: "WED",
  WEDS: "WED",
  WEDNESDAY: "WED",
  WEDNESDAYS: "WED",
  TH: "THU",
  THU: "THU",
  THUR: "THU",
  THURS: "THU",
  THURSDAY: "THU",
  THURSDAYS: "THU",
  F: "FRI",
  FR: "FRI",
  FRI: "FRI",
  FRIDAY: "FRI",
  FRIDAYS: "FRI",
  S: "SAT",
  SA: "SAT",
  SAT: "SAT",
  SATURDAY: "SAT",
  SATURDAYS: "SAT",
  SU: "SUN",
  SUN: "SUN",
  SUNDAY: "SUN",
  SUNDAYS: "SUN",
};

export function normalizeDay(raw: string): Day | null {
  const key = raw.trim().toUpperCase().replace(/-/g, "").replace(/\./g, "");
  return DAY_ALIASES[key] ?? null;
}

function parseSingleTime(input: string): string | null {
  let s = input.trim().toLowerCase();

  // "noon" / "midnight"
  if (/^noo?n$/.test(s)) return "12:00";
  if (/^midnight$/.test(s)) return "00:00";

  // Drop trailing meridiem whether or not a space separates it ("8:00 am", "8am").
  const meridiemMatch = s.match(/\s*(am|pm)$/);
  const meridiem = meridiemMatch ? meridiemMatch[1] : null;
  if (meridiem && meridiemMatch) s = s.slice(0, meridiemMatch.index).trim();

  // "0800" / "0830" military style
  if (/^\d{3,4}$/.test(s)) {
    s =
      String(Math.min(parseInt(s.slice(0, -2), 10), 23)).padStart(2, "0") +
      ":" +
      s.slice(-2).padStart(2, "0");
  }

  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
  if (!m) return null;

  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3]) return null; // seconds not supported
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeTime(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();

  // Models sometimes merge the range into one field: "8:00 AM - 9:30 AM".
  // Keep only the start side.
  const rangeSplit = s.search(/\s*(?:-|–|—|to)\s*/i);
  if (rangeSplit > 0 && !/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(s)) {
    s = s.slice(0, rangeSplit).trim();
  }

  return parseSingleTime(s);
}

/** Current HH:MM (24h) in the given IANA timezone. */
export function timeNowInTz(tz: string, now: Date = new Date()): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    return normalizeTime(parts);
  } catch {
    return null;
  }
}

/** Minutes since local midnight in the given timezone. */
export function minutesNowInTz(tz: string, now: Date = new Date()): number | null {
  const t = timeNowInTz(tz, now);
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Weekday of tomorrow in the given timezone — used by the nightly reminder,
 * which runs in the evening and should preview the next day's classes. */
export function tomorrowWeekdayInTz(tz: string, now: Date = new Date()): Day | null {
  try {
    const label = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: tz,
    }).format(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    return normalizeDay(label) ?? null;
  } catch {
    return weekdayInTz(tz);
  }
}

export function formatDayShort(day: Day): string {
  return day.slice(0, 1) + day.slice(1, 2).toLowerCase();
}

export function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function weekdayInTz(tz: string, now: Date = new Date()): Day | null {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: tz,
  }).format(now);
  return normalizeDay(label) ?? null;
}

export function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date());
}

export function toYmd(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(date);
}

export function nextDateForDay(day: Day, tz: string, from: Date = new Date()): string {
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(from.getTime() + i * 86400000);
    const label = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: tz,
    }).format(candidate);
    if (normalizeDay(label) === day) return toYmd(candidate, tz);
  }
  return toYmd(from, tz);
}

export function rruleUntil(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function defaultSemesterEnd(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 120);
  return d;
}

export function parseUntilInput(input: string | undefined): string {
  const base = input ? new Date(input) : defaultSemesterEnd();
  if (Number.isNaN(base.getTime())) return rruleUntil(defaultSemesterEnd());
  return rruleUntil(base);
}