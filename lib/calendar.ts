import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { nextDateForDay, parseUntilInput, DAY_TO_RRULE, type Day } from "@/lib/days";

export function isScopeError(err: unknown): boolean {
  const e = err as { response?: { status?: number }; status?: number; code?: number };
  return (
    e?.response?.status === 403 ||
    e?.status === 403 ||
    e?.code === 403
  );
}

export async function getCalendarForUser(userId: string) {
  const account = await prisma.account.findFirst({ where: { userId } });
  if (!account?.refresh_token && !account?.access_token) return null;
  const client = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    : null;
  if (!client) return null;
  client.setCredentials({
    refresh_token: account.refresh_token ?? undefined,
    access_token: account.access_token ?? undefined,
  });
  return google.calendar({ version: "v3", auth: client });
}

export interface CreateEventInput {
  courseName: string;
  daysOfWeek: Day[];
  startTime: string;
  endTime: string;
  room: string | null;
  timezone: string;
  semesterEnd?: string;
  location?: string;
}

function wallClock(instantMs: number, timeZone: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(instantMs)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  return {
    y: Number(parts.year),
    mo: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour) % 24,
    mi: Number(parts.minute),
  };
}

function epochInTz(date: string, time: string, timeZone: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const asUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  const w = wallClock(asUTC, timeZone);
  const wallUTC = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, 0);
  const offset = wallUTC - asUTC;
  return asUTC - offset;
}

export async function findExistingEvent(
  calendar: ReturnType<typeof getCalendarForUser> extends Promise<infer T> ? NonNullable<T> : never,
  courseName: string,
  startTime: string,
  date: string,
  timezone: string
): Promise<string | null> {
  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: `${date}T00:00:00`,
      timeMax: `${date}T23:59:59`,
      singleEvents: false,
      maxResults: 250,
    });
    const target = epochInTz(date, startTime, timezone);
    for (const ev of res.data.items ?? []) {
      if (ev.status === "cancelled") continue;
      if (ev.summary?.trim().toLowerCase() !== courseName.trim().toLowerCase()) continue;
      const s = ev.start?.dateTime;
      if (s && Date.parse(s) === target) return ev.id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

const APP_MARKER = "Created by Scheduler (Mapúa MCL schedule sync)";

export function isAppEvent(ev: {
  summary?: string | null;
  description?: string | null;
  recurrence?: string[] | null;
}): boolean {
  if (ev.description?.includes(APP_MARKER)) return true;
  const rrule = ev.recurrence?.[0] ?? "";
  return /RRULE:FREQ=WEEKLY;BYDAY=[A-Z,]+;UNTIL=\d{8}T\d{6}Z/.test(rrule);
}

export async function createWeeklyEvent(
  userId: string,
  input: CreateEventInput
): Promise<{ id: string } | null> {
  const calendar = await getCalendarForUser(userId);
  if (!calendar) return null;

  const date = nextDateForDay(input.daysOfWeek[0], input.timezone);
  const existingId = await findExistingEvent(calendar, input.courseName, input.startTime, date, input.timezone);
  if (existingId) return { id: existingId };

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.courseName,
        location: input.room ?? undefined,
        description: APP_MARKER,
        start: { dateTime: `${date}T${input.startTime}:00`, timeZone: input.timezone },
        end: { dateTime: `${date}T${input.endTime}:00`, timeZone: input.timezone },
        recurrence: [
          `RRULE:FREQ=WEEKLY;BYDAY=${input.daysOfWeek.map((d) => DAY_TO_RRULE[d]).join(",")};UNTIL=${parseUntilInput(input.semesterEnd)}`,
        ],
      },
    });

    return res.data.id ? { id: res.data.id } : null;
  } catch (err) {
    if (isScopeError(err)) {
      throw new ApiError(
        403,
        "Google Calendar permission is missing. Sign out and sign back in, and approve the calendar permission this time."
      );
    }
    throw err;
  }
}

export async function updateWeeklyEvent(
  userId: string,
  eventId: string,
  input: CreateEventInput
): Promise<boolean> {
  const calendar = await getCalendarForUser(userId);
  if (!calendar) return false;

  const date = nextDateForDay(input.daysOfWeek[0], input.timezone);
  try {
    await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: {
        summary: input.courseName,
        location: input.room ?? undefined,
        description: APP_MARKER,
        start: { dateTime: `${date}T${input.startTime}:00`, timeZone: input.timezone },
        end: { dateTime: `${date}T${input.endTime}:00`, timeZone: input.timezone },
        recurrence: [
          `RRULE:FREQ=WEEKLY;BYDAY=${input.daysOfWeek.map((d) => DAY_TO_RRULE[d]).join(",")};UNTIL=${parseUntilInput(input.semesterEnd)}`,
        ],
      },
    });

    return true;
  } catch (err) {
    if (isScopeError(err)) {
      throw new ApiError(
        403,
        "Google Calendar permission is missing. Sign out and sign back in, and approve the calendar permission this time."
      );
    }
    throw err;
  }
}

export async function deleteWeeklyEvent(userId: string, eventId: string): Promise<boolean> {
  const calendar = await getCalendarForUser(userId);
  if (!calendar) return false;
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
    return true;
  } catch (err) {
    if (isScopeError(err)) {
      throw new ApiError(
        403,
        "Google Calendar permission is missing. Sign out and sign back in, and approve the calendar permission this time."
      );
    }
    throw err;
  }
}