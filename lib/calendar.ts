import { createHash } from "node:crypto";
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

export function isAuthError(err: unknown): boolean {
  const e = err as {
    response?: { status?: number };
    status?: number;
    code?: number;
    message?: string;
  };
  if (e?.response?.status === 401 || e?.status === 401 || e?.code === 401) return true;
  if (e?.code === 400) return true;
  return typeof e?.message === "string" && /invalid_grant|invalid authentication credentials/i.test(e.message);
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
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // If the stored access token is stale and a refresh token exists, the
  // client refreshes it now (without expiry_date it would blindly reuse
  // the expired token and Google returns 401).
  const expired = !account.expires_at || account.expires_at * 1000 <= Date.now();
  if (expired) {
    if (!account.refresh_token) {
      throw new ApiError(
        401,
        "Google Calendar access expired. Sign out and sign back in with Google, or click Reconnect in Settings to restore sync."
      );
    }
    try {
      const token = await client.getAccessToken();
      const fresh = token?.token;
      const newExpiry = client.credentials.expiry_date
        ? Math.floor(client.credentials.expiry_date / 1000)
        : null;
      if (fresh && (fresh !== account.access_token || newExpiry !== account.expires_at)) {
        await prisma.account.updateMany({
          where: { userId },
          data: { access_token: fresh, expires_at: newExpiry },
        });
      }
    } catch (err) {
      if (isAuthError(err)) {
        throw new ApiError(
          401,
          "Google Calendar access expired. Sign out and sign back in with Google, or click Reconnect in Settings to restore sync."
        );
      }
      throw err;
    }
  }

  return google.calendar({ version: "v3", auth: client });
}

export type CalendarClient = NonNullable<Awaited<ReturnType<typeof getCalendarForUser>>>;

export interface CreateEventInput {
  scheduleId?: string;
  courseName: string;
  daysOfWeek: Day[];
  startTime: string;
  endTime: string;
  room: string | null;
  timezone: string;
  semesterEnd?: string;
  location?: string;
}

export function scheduleCalendarEventId(scheduleId: string): string {
  // Google accepts lower-case base32hex IDs; hexadecimal is a valid subset.
  // A stable ID closes the race between overlapping retries that both search
  // before either request has made its event visible in Calendar's index.
  return createHash("sha256").update(`scheduler:${scheduleId}`).digest("hex").slice(0, 40);
}

const APP_MARKER = "Created by Scheduler (Mapúa MCL schedule sync)";

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
  calendar: CalendarClient,
  courseName: string,
  startTime: string,
  date: string,
  timezone: string,
  scheduleId?: string
): Promise<string | null> {
  try {
    if (scheduleId) {
      const owned = await calendar.events.list({
        calendarId: "primary",
        privateExtendedProperty: [`schedulerScheduleId=${scheduleId}`],
        singleEvents: false,
        maxResults: 10,
      });
      const ownedId = owned.data.items?.find((event) => event.status !== "cancelled")?.id;
      if (ownedId) return ownedId;
    }

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: `${date}T00:00:00`,
      timeMax: `${date}T23:59:59`,
      timeZone: timezone,
      singleEvents: false,
      maxResults: 250,
    });
    const target = epochInTz(date, startTime, timezone);
    for (const ev of res.data.items ?? []) {
      if (ev.status === "cancelled") continue;
      const belongsToSchedule =
        (scheduleId && ev.extendedProperties?.private?.schedulerScheduleId === scheduleId) ||
        ev.description === APP_MARKER;
      if (!belongsToSchedule) continue;
      if (ev.summary?.trim().toLowerCase() !== courseName.trim().toLowerCase()) continue;
      const s = ev.start?.dateTime;
      if (s && Date.parse(s) === target) return ev.id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

function weeklyEventBody(input: CreateEventInput) {
  const date = nextDateForDay(input.daysOfWeek[0], input.timezone);
  return {
    summary: input.courseName,
    location: input.room ?? undefined,
    description: APP_MARKER,
    start: { dateTime: `${date}T${input.startTime}:00`, timeZone: input.timezone },
    end: { dateTime: `${date}T${input.endTime}:00`, timeZone: input.timezone },
    recurrence: [
      `RRULE:FREQ=WEEKLY;BYDAY=${input.daysOfWeek.map((d) => DAY_TO_RRULE[d]).join(",")};UNTIL=${parseUntilInput(input.semesterEnd)}`,
    ],
    ...(input.scheduleId
      ? { extendedProperties: { private: { schedulerScheduleId: input.scheduleId } } }
      : {}),
  };
}

export async function createWeeklyEvent(
  userId: string,
  input: CreateEventInput
): Promise<{ id: string } | null> {
  const calendar = await getCalendarForUser(userId);
  if (!calendar) return null;

  return createOrReuseWeeklyEvent(calendar, input);
}

export async function createOrReuseWeeklyEvent(
  calendar: CalendarClient,
  input: CreateEventInput
): Promise<{ id: string } | null> {

  const date = nextDateForDay(input.daysOfWeek[0], input.timezone);
  const existingId = await findExistingEvent(
    calendar,
    input.courseName,
    input.startTime,
    date,
    input.timezone,
    input.scheduleId
  );
  const stableEventId = input.scheduleId ? scheduleCalendarEventId(input.scheduleId) : undefined;

  try {
    const res = existingId
      ? await calendar.events.update({
          calendarId: "primary",
          eventId: existingId,
          requestBody: weeklyEventBody(input),
        })
      : await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            ...weeklyEventBody(input),
            ...(stableEventId ? { id: stableEventId } : {}),
          },
        });

    return res.data.id ? { id: res.data.id } : null;
  } catch (err) {
    const apiError = err as { response?: { status?: number }; status?: number; code?: number };
    const status = apiError?.response?.status ?? apiError?.status ?? apiError?.code;
    if (!existingId && stableEventId && status === 409) {
      try {
        const existing = await calendar.events.get({ calendarId: "primary", eventId: stableEventId });
        if (
          existing.data.id &&
          existing.data.extendedProperties?.private?.schedulerScheduleId === input.scheduleId
        ) {
          return { id: existing.data.id };
        }
      } catch {
        // Preserve the original insert error if the conflict cannot be verified.
      }
    }
    if (isScopeError(err)) {
      throw new ApiError(
        403,
        "Google Calendar permission is missing. Sign out and sign back in, and approve the calendar permission this time."
      );
    }
    if (isAuthError(err)) {
      throw new ApiError(
        401,
        "Your Google Calendar connection expired. Reconnect in Settings to keep syncing."
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

  try {
    await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: weeklyEventBody(input),
    });

    return true;
  } catch (err) {
    if (isScopeError(err)) {
      throw new ApiError(
        403,
        "Google Calendar permission is missing. Sign out and sign back in, and approve the calendar permission this time."
      );
    }
    if (isAuthError(err)) {
      throw new ApiError(
        401,
        "Your Google Calendar connection expired. Reconnect in Settings to keep syncing."
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
    if (isAuthError(err)) {
      throw new ApiError(
        401,
        "Your Google Calendar connection expired. Reconnect in Settings to keep syncing."
      );
    }
    throw err;
  }
}
