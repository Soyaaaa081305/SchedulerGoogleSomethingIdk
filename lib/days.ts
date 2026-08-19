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

export function normalizeTime(raw: string): string | null {
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3];
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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

export function weekdayInTz(tz: string): Day | null {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: tz,
  }).format(new Date());
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

export function nextDateForDay(day: Day, tz: string): string {
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(now.getTime() + i * 86400000);
    const label = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: tz,
    }).format(candidate);
    if (normalizeDay(label) === day) return toYmd(candidate, tz);
  }
  return toYmd(now, tz);
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