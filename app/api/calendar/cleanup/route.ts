import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { getCalendarForUser } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const APP_RRULE = /RRULE:FREQ=WEEKLY;BYDAY=[A-Z,]+;UNTIL=(\d{8})T\d{6}Z/;

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

    const linked = await prisma.schedule.findMany({
      where: { userId, googleEventId: { not: null } },
      select: { googleEventId: true },
    });
    const linkedIds = new Set(linked.map((s) => s.googleEventId!));

    let pageToken: string | undefined;
    let candidates = 0;
    let deleted = 0;

    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: sixMonthsAgo.toISOString(),
        singleEvents: false,
        orderBy: "startTime",
        maxResults: 250,
        pageToken,
      });

      for (const ev of res.data.items ?? []) {
        const rrule = ev.recurrence?.[0];
        if (!rrule || !APP_RRULE.test(rrule)) continue;
        candidates++;
        if (linkedIds.has(ev.id ?? "")) continue;
        if (!ev.id) continue;
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
