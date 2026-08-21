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

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let pageToken: string | undefined;
    let candidates = 0;
    let deleted = 0;

    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: oneYearAgo.toISOString(),
        singleEvents: false,
        maxResults: 250,
        pageToken,
      });

      for (const ev of res.data.items ?? []) {
        if (!ev.id) continue;
        if (linkedIds.has(ev.id)) continue;

        candidates++;
        const result = await calendar.events
          .delete({ calendarId: "primary", eventId: ev.id })
          .then(() => true)
          .catch(() => false);
        if (result) deleted++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return NextResponse.json({ ok: true, deleted, candidates });
  } catch (err) {
    return handleError(err);
  }
}
