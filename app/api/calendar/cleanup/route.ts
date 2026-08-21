import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { getCalendarForUser, isAppEvent } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const WEEKLY_RRULE = /RRULE:FREQ=WEEKLY/;

export async function POST() {
  try {
    const userId = await requireUser();
    const calendar = await getCalendarForUser(userId);
    if (!calendar) {
      return NextResponse.json(
        { error: "Google Calendar is not connected. Connect it first." },
        { status: 403 }
      );
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const mySchedules = await prisma.schedule.findMany({
      where: { userId },
      select: { googleEventId: true, courseName: true },
    });
    const linkedIds = new Set(mySchedules.map((s) => s.googleEventId).filter(Boolean));
    const myCourseNames = new Set(
      mySchedules.map((s) => s.courseName.trim().toLowerCase())
    );

    let pageToken: string | undefined;
    let candidates = 0;
    let deleted = 0;

    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: sixMonthsAgo.toISOString(),
        singleEvents: false,
        maxResults: 250,
        pageToken,
      });

      for (const ev of res.data.items ?? []) {
        if (linkedIds.has(ev.id ?? "")) continue;
        const rrule = ev.recurrence?.[0];
        const hasMarker = isAppEvent(ev);
        const isMyClass =
          myCourseNames.has((ev.summary ?? "").trim().toLowerCase()) &&
          rrule &&
          WEEKLY_RRULE.test(rrule);
        if (!hasMarker && !isMyClass) continue;
        if (!ev.id) continue;
        candidates++;
        await calendar.events.delete({ calendarId: "primary", eventId: ev.id }).catch(() => {});
        deleted++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return NextResponse.json({ ok: true, deleted, candidates });
  } catch (err) {
    return handleError(err);
  }
}
