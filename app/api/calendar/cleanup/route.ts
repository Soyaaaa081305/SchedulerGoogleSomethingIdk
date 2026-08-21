import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { getCalendarForUser } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const WEEKLY_RRULE = /RRULE:FREQ=WEEKLY/;

function looksLikeClassEvent(ev: {
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  recurrence?: string[] | null;
}): boolean {
  const rrule = ev.recurrence?.[0] ?? "";
  if (!WEEKLY_RRULE.test(rrule)) return false;

  const startStr = ev.start?.dateTime;
  if (!startStr) return false;
  const hour = new Date(startStr).getUTCHours();
  const day = new Date(startStr).getUTCDay();
  if (day === 0 || day === 6) return false;
  return hour >= 6 && hour < 20;
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    const calendar = await getCalendarForUser(userId);
    if (!calendar) {
      return NextResponse.json(
        { error: "Google Calendar is not connected. Reconnect in Settings." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const aggressive = searchParams.get("aggressive") === "1";

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const mySchedules = await prisma.schedule.findMany({
      where: { userId },
      select: { googleEventId: true, courseName: true },
    });
    const linkedIds = new Set(
      mySchedules.map((s) => s.googleEventId).filter(Boolean)
    );
    const myCourseNames = new Set(
      mySchedules.map((s) => s.courseName.trim().toLowerCase())
    );

    let pageToken: string | undefined;
    let candidates = 0;
    let deleted = 0;

    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: twoYearsAgo.toISOString(),
        singleEvents: false,
        maxResults: 250,
        pageToken,
      });

      for (const ev of res.data.items ?? []) {
        if (linkedIds.has(ev.id ?? "")) continue;
        if (!ev.id) continue;

        const rrule = ev.recurrence?.[0] ?? "";
        if (!WEEKLY_RRULE.test(rrule)) continue;

        const hasMarker =
          ev.description?.includes("Created by Scheduler") ?? false;
        const isKnownClass = myCourseNames.has(
          (ev.summary ?? "").trim().toLowerCase()
        );

        if (aggressive) {
          if (!looksLikeClassEvent(ev)) continue;
        } else {
          if (!hasMarker && !isKnownClass) continue;
        }

        candidates++;
        await calendar.events
          .delete({ calendarId: "primary", eventId: ev.id })
          .catch(() => {});
        deleted++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return NextResponse.json({ ok: true, deleted, candidates });
  } catch (err) {
    return handleError(err);
  }
}
