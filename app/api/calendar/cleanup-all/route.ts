import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { getCalendarForUser } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await requireUser();
    const calendar = await getCalendarForUser(userId);
    if (!calendar) {
      return NextResponse.json(
        { error: "Google Calendar is not connected. Reconnect in Settings." },
        { status: 403 }
      );
    }

    const mySchedules = await prisma.schedule.findMany({
      where: { userId },
      select: { googleEventId: true },
    });
    const linkedIds = new Set(
      mySchedules.map((s) => s.googleEventId).filter(Boolean)
    );

    const calList = await calendar.calendarList.list();
    const calendars = calList.data.items ?? [];
    const calIds = calendars.map((c) => c.id).filter(Boolean) as string[];

    let totalDeleted = 0;
    let totalCandidates = 0;

    for (const calId of calIds) {
      let pageToken: string | undefined;
      do {
        const res = await calendar.events.list({
          calendarId: calId,
          singleEvents: false,
          maxResults: 250,
          pageToken,
        });

        for (const ev of res.data.items ?? []) {
          if (!ev.id) continue;
          if (linkedIds.has(ev.id)) continue;

          totalCandidates++;
          const result = await calendar.events
            .delete({ calendarId: calId, eventId: ev.id })
            .then(() => true)
            .catch(() => false);
          if (result) totalDeleted++;
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    }

    return NextResponse.json({ ok: true, deleted: totalDeleted, candidates: totalCandidates, calendars: calIds });
  } catch (err) {
    return handleError(err);
  }
}
