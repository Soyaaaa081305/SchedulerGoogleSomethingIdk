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

export async function createWeeklyEvent(
  userId: string,
  input: CreateEventInput
): Promise<{ id: string } | null> {
  const calendar = await getCalendarForUser(userId);
  if (!calendar) return null;

  const date = nextDateForDay(input.daysOfWeek[0], input.timezone);
  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.courseName,
        location: input.room ?? undefined,
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